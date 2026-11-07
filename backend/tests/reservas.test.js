import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../src/config/env.js';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import Aula from '../src/models/aula.model.js';
import Reserva from '../src/models/reserva.model.js';
import HistorialReserva from '../src/models/historial.model.js';
import { hoyArgentina, horaActualArgentina } from '../src/utils/fecha.js';
import { manejadorErrores } from '../src/middleware/error.middleware.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

const fechaFutura = (diasOffset) => {
  const [anio, mes, dia] = hoyArgentina().split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + diasOffset);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

let passwordHash;
let adminToken;
let usuarioToken;
let otroUsuarioToken;
let usuario;
let otroUsuario;
let aula;
let reservaPendiente;
let reservaOtroUsuario;

beforeAll(async () => {
  passwordHash = await bcrypt.hash('password123', 10);
});

beforeEach(async () => {
  await limpiarBaseDeDatos();

  const admin = await Usuario.create({ nombre: 'Admin Test', email: 'admin@test.com', passwordHash, rol: 'admin', activo: true });
  usuario = await Usuario.create({ nombre: 'User Test A', email: 'user@test.com', passwordHash, rol: 'usuario', activo: true });
  otroUsuario = await Usuario.create({ nombre: 'User Test B', email: 'userb@test.com', passwordHash, rol: 'usuario', activo: true });

  adminToken = jwt.sign({ id: admin.id, nombre: admin.nombre, email: admin.email, rol: admin.rol }, env.JWT_SECRET, { expiresIn: '2h' });
  usuarioToken = jwt.sign({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }, env.JWT_SECRET, { expiresIn: '2h' });
  otroUsuarioToken = jwt.sign({ id: otroUsuario.id, nombre: otroUsuario.nombre, email: otroUsuario.email, rol: otroUsuario.rol }, env.JWT_SECRET, { expiresIn: '2h' });

  aula = await Aula.create({ nombre: 'Aula de Prueba', ubicacion: 'Piso 1', capacidad: 20, recursos: 'pizarra', activa: true });

  const fechaBase = fechaFutura(1);

  reservaPendiente = await Reserva.create({
    aulaId: aula.id,
    usuarioId: usuario.id,
    fecha: fechaBase,
    horaInicio: '10:00',
    horaFin: '12:00',
    cantidadPersonas: 10,
    motivo: 'Reserva de prueba usuario A',
    estado: 'pendiente'
  });

  reservaOtroUsuario = await Reserva.create({
    aulaId: aula.id,
    usuarioId: otroUsuario.id,
    fecha: fechaBase,
    horaInicio: '14:00',
    horaFin: '16:00',
    cantidadPersonas: 8,
    motivo: 'Reserva de prueba usuario B',
    estado: 'pendiente'
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Reservas API', () => {
  it('should reject access to protected route without JWT', async () => {
    const response = await request(app).get('/api/reservas');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Token no informado');
  });

  it('should reject admin-only action for normal user', async () => {
    const response = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/aprobar`)
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error', 'Acceso denegado: se requiere rol admin');
  });

  it('should list reservas with and without filters', async () => {
    const responseAll = await request(app)
      .get('/api/reservas')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(responseAll.status).toBe(200);
    expect(responseAll.body).toHaveProperty('datos');
    expect(Array.isArray(responseAll.body.datos)).toBe(true);

    const responseFiltered = await request(app)
      .get(`/api/reservas?estado=pendiente&page=1&limit=5&sortBy=horaInicio&order=ASC`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(responseFiltered.status).toBe(200);
    expect(responseFiltered.body).toHaveProperty('datos');
    expect(responseFiltered.body.datos.every((r) => r.estado === 'pendiente')).toBe(true);
  });

  it('should cap limit=100000 to 100 in obtenerReservas', async () => {
    const response = await request(app)
      .get('/api/reservas?limit=100000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.porPagina).toBe(100);
  });

  it('should not fail when sortBy or order are invalid', async () => {
    const response = await request(app)
      .get('/api/reservas?sortBy=columnaInexistente&order=cualquierCosa')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.datos)).toBe(true);
  });

  it('should not show other users reservations to a normal user in the list', async () => {
    const response = await request(app)
      .get('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(response.status).toBe(200);
    expect(response.body.datos.length).toBeGreaterThan(0);
    expect(response.body.datos.every((r) => r.usuarioId === usuario.id)).toBe(true);
    expect(response.body.datos.some((r) => r.id === reservaOtroUsuario.id)).toBe(false);
  });

  it('should return 404 when user A requests reservation or history of user B', async () => {
    const detailResponse = await request(app)
      .get(`/api/reservas/${reservaOtroUsuario.id}`)
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(detailResponse.status).toBe(404);
    expect(detailResponse.body).toHaveProperty('error', 'La reserva no existe');

    const historyResponse = await request(app)
      .get(`/api/reservas/${reservaOtroUsuario.id}/historial`)
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(historyResponse.status).toBe(404);
    expect(historyResponse.body).toHaveProperty('error', 'La reserva no existe');
  });

  it('should reject cancelarReserva with 403 when user is neither admin nor owner (including non-standard role)', async () => {
    const responseOtroUsuario = await request(app)
      .patch(`/api/reservas/${reservaOtroUsuario.id}/cancelar`)
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(responseOtroUsuario.status).toBe(403);
    expect(responseOtroUsuario.body).toHaveProperty('error', 'No tienes permiso para cancelar esta reserva');

    const tokenRolDesconocido = jwt.sign(
      { id: 99999, nombre: 'Invitado', email: 'invitado@test.com', rol: 'invitado' },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    const responseRolDesconocido = await request(app)
      .patch(`/api/reservas/${reservaOtroUsuario.id}/cancelar`)
      .set('Authorization', `Bearer ${tokenRolDesconocido}`);

    expect(responseRolDesconocido.status).toBe(403);
    expect(responseRolDesconocido.body).toHaveProperty('error', 'No tienes permiso para cancelar esta reserva');
  });

  it('should return reservation detail for existing id', async () => {
    const response = await request(app)
      .get(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', reservaPendiente.id);
    expect(response.body).toHaveProperty('aulaId', aula.id);
    expect(response.body).toHaveProperty('horaInicio', '10:00');
    expect(response.body).toHaveProperty('horaFin', '12:00');
  });

  it('should return 404 for non-existent reservation detail', async () => {
    const response = await request(app)
      .get('/api/reservas/9999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'La reserva no existe');
  });

  it('should create a valid reservation', async () => {
    const response = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaFutura(2),
        horaInicio: '12:30',
        horaFin: '13:30',
        cantidadPersonas: 10,
        motivo: 'Reunión de equipo'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('estado', 'pendiente');
    expect(response.body).toHaveProperty('horaInicio', '12:30');
    expect(response.body).toHaveProperty('horaFin', '13:30');
  });

  it('should reject reservation creation due capacity insufficient', async () => {
    const response = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaFutura(3),
        horaInicio: '09:00',
        horaFin: '10:00',
        cantidadPersonas: 50,
        motivo: 'Actividad grande'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'La cantidad de personas supera la capacidad del aula');
  });

  it('should reject reservation creation due overlapping schedule', async () => {
    const response = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaFutura(1),
        horaInicio: '11:00',
        horaFin: '13:00',
        cantidadPersonas: 5,
        motivo: 'Superposición de prueba'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'El aula ya está reservada en ese horario');
  });

  it('should reject invalid edit because of schedule conflict', async () => {
    const fechaEdicion = fechaFutura(2);
    await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: fechaEdicion,
      horaInicio: '14:00',
      horaFin: '16:00',
      cantidadPersonas: 5,
      motivo: 'Reserva conflicto',
      estado: 'pendiente'
    });

    const reservaParaEditar = await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: fechaEdicion,
      horaInicio: '16:00',
      horaFin: '18:00',
      cantidadPersonas: 5,
      motivo: 'Reserva para editar',
      estado: 'pendiente'
    });

    const response = await request(app)
      .put(`/api/reservas/${reservaParaEditar.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fecha: fechaEdicion,
        horaInicio: '15:30',
        horaFin: '17:00',
        cantidadPersonas: 5,
        motivo: 'Intento conflictivo'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'El aula ya está reservada en ese horario');
  });

  it('should reject approving a cancelled reservation', async () => {
    const reservaCancelada = await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: fechaFutura(4),
      horaInicio: '08:00',
      horaFin: '09:00',
      cantidadPersonas: 5,
      motivo: 'Reserva cancelada',
      estado: 'cancelada'
    });

    const response = await request(app)
      .patch(`/api/reservas/${reservaCancelada.id}/aprobar`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Solo se pueden aprobar reservas pendientes');
  });

  // ==========================================
  // TESTS FASE 3 — LÓGICA DE NEGOCIO Y CONCURRENCIA
  // ==========================================

  it('should allow exactly one 201 and nine 400 when 10 concurrent POST requests target the same slot', async () => {
    const fechaConcurrente = fechaFutura(5);

    const promesas = Array.from({ length: 10 }, (_, idx) =>
      request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${usuarioToken}`)
        .send({
          aulaId: aula.id,
          fecha: fechaConcurrente,
          horaInicio: '10:00',
          horaFin: '12:00',
          cantidadPersonas: 10,
          motivo: `Reserva concurrente #${idx + 1}`
        })
    );

    const respuestas = await Promise.all(promesas);
    const creadas = respuestas.filter((r) => r.status === 201);
    const rechazadas = respuestas.filter((r) => r.status === 400);

    expect(creadas).toHaveLength(1);
    expect(rechazadas).toHaveLength(9);
    rechazadas.forEach((r) => {
      expect(r.body).toHaveProperty('error', 'El aula ya está reservada en ese horario');
    });

    const totalEnBd = await Reserva.count({
      where: { aulaId: aula.id, fecha: fechaConcurrente }
    });
    expect(totalEnBd).toBe(1);
  });

  it('should return 400 when editing a reservation to overlap another even if pre-check is bypassed (23P01)', async () => {
    const fechaConflicto = fechaFutura(6);

    await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: fechaConflicto,
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 10,
      motivo: 'Reserva base',
      estado: 'aprobada'
    });

    const reservaAEditar = await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: fechaConflicto,
      horaInicio: '14:00',
      horaFin: '16:00',
      cantidadPersonas: 10,
      motivo: 'Reserva a mover',
      estado: 'pendiente'
    });

    const originalFindOne = Reserva.findOne.bind(Reserva);
    const findOneSpy = jest.spyOn(Reserva, 'findOne').mockImplementation(async (options) => {
      if (options?.where?.estado) {
        return null; // Saltea el chequeo previo en memoria para que actúe la constraint 23P01 en Postgres
      }
      return originalFindOne(options);
    });

    try {
      const response = await request(app)
        .put(`/api/reservas/${reservaAEditar.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          horaInicio: '11:00',
          horaFin: '13:00'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'El aula ya está reservada en ese horario');
    } finally {
      findOneSpy.mockRestore();
    }
  });

  it('should not block new reservation when existing reservation in same slot is cancelled', async () => {
    const fechaSlot = fechaFutura(7);

    const cancelarRes = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/cancelar`)
      .set('Authorization', `Bearer ${usuarioToken}`);
    expect(cancelarRes.status).toBe(200);
    expect(cancelarRes.body.estado).toBe('cancelada');

    // Crear en el mismo horario de reservaPendiente (fechaFutura(1), 10:00 - 12:00)
    const nuevaEnMismoSlot = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${otroUsuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaFutura(1),
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 12,
        motivo: 'Reemplaza a la cancelada'
      });

    expect(nuevaEnMismoSlot.status).toBe(201);
    expect(nuevaEnMismoSlot.body.estado).toBe('pendiente');

    // Y también si se crea directamente cancelada en otra fecha
    await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: fechaSlot,
      horaInicio: '08:00',
      horaFin: '10:00',
      cantidadPersonas: 10,
      motivo: 'Cancelada previa',
      estado: 'cancelada'
    });

    const postSobreCancelada = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaSlot,
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 10,
        motivo: 'Nueva sobre cancelada'
      });

    expect(postSobreCancelada.status).toBe(201);
  });

  it('should allow consecutive reservations touching at exact boundary 10:00/10:00', async () => {
    const fechaBorde = fechaFutura(8);

    const primera = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaBorde,
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 10,
        motivo: 'Bloque 08 a 10'
      });
    expect(primera.status).toBe(201);

    const segunda = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaBorde,
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 10,
        motivo: 'Bloque 10 a 12'
      });
    expect(segunda.status).toBe(201);
  });

  it('should compute "hoy" and obtenerResumen correctly at 22:00 Argentina time (01:00 UTC next day)', async () => {
    // 2026-11-08T01:00:00.000Z corresponde a las 22:00 del 2026-11-07 en America/Argentina/Cordoba (UTC-3)
    const instante22hsArg = new Date('2026-11-08T01:00:00.000Z');

    expect(hoyArgentina(instante22hsArg)).toBe('2026-11-07');
    expect(horaActualArgentina(instante22hsArg)).toBe('22:00');

    jest.useFakeTimers({
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout'
      ]
    });
    jest.setSystemTime(instante22hsArg);

    try {
      expect(hoyArgentina()).toBe('2026-11-07');
      expect(horaActualArgentina()).toBe('22:00');

      const tokenAdmin22hs = jwt.sign(
        { id: 1, nombre: 'Admin Test', email: 'admin@test.com', rol: 'admin' },
        env.JWT_SECRET,
        { expiresIn: '2h' }
      );

      const reservaNocturnaHoy = await Reserva.create({
        aulaId: aula.id,
        usuarioId: usuario.id,
        fecha: '2026-11-07',
        horaInicio: '22:00',
        horaFin: '23:00',
        cantidadPersonas: 10,
        motivo: 'Reserva nocturna de hoy a las 22:00',
        estado: 'aprobada'
      });

      const response = await request(app)
        .get('/api/reservas/resumen')
        .set('Authorization', `Bearer ${tokenAdmin22hs}`);

      expect(response.status).toBe(200);
      expect(response.body.proximasHoy.some((r) => r.id === reservaNocturnaHoy.id)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should reject past dates and invalid field formats on POST and PUT /api/reservas', async () => {
    const fechaPasada = fechaFutura(-1);

    const resPasada = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaPasada,
        horaInicio: '10:00',
        horaFin: '11:00',
        cantidadPersonas: 10,
        motivo: 'Intento en fecha pasada'
      });
    expect(resPasada.status).toBe(400);
    expect(resPasada.body.error).toMatch(/pasada/i);

    const resPutPasada = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fecha: fechaPasada });
    expect(resPutPasada.status).toBe(400);
    expect(resPutPasada.body.error).toMatch(/pasada/i);

    const resFechaInvalida = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: '2026-02-30',
        horaInicio: '10:00',
        horaFin: '11:00',
        cantidadPersonas: 10,
        motivo: 'Fecha inexistente'
      });
    expect(resFechaInvalida.status).toBe(400);

    const resHoraInvalida = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaFutura(2),
        horaInicio: '9:00',
        horaFin: '11:00',
        cantidadPersonas: 10,
        motivo: 'Hora sin cero inicial'
      });
    expect(resHoraInvalida.status).toBe(400);

    const resCantidadCero = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaFutura(2),
        horaInicio: '10:00',
        horaFin: '11:00',
        cantidadPersonas: 0,
        motivo: 'Cero personas'
      });
    expect(resCantidadCero.status).toBe(400);

    const resMotivoLargo = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: fechaFutura(2),
        horaInicio: '10:00',
        horaFin: '11:00',
        cantidadPersonas: 10,
        motivo: 'x'.repeat(256)
      });
    expect(resMotivoLargo.status).toBe(400);

    const resAulaIdInvalido = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: 'no-es-entero',
        fecha: fechaFutura(2),
        horaInicio: '10:00',
        horaFin: '11:00',
        cantidadPersonas: 10,
        motivo: 'Aula inválida'
      });
    expect(resAulaIdInvalido.status).toBe(400);
  });

  it('should not ignore 0 in cantidadPersonas on PUT and should verify aula remains active (L4)', async () => {
    const resPutCero = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cantidadPersonas: 0 });
    expect(resPutCero.status).toBe(400);

    await aula.update({ activa: false });

    const resAulaInactiva = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ motivo: 'Intento editar en aula desactivada' });

    expect(resAulaInactiva.status).toBe(400);
    expect(resAulaInactiva.body.error).toMatch(/activa/i);
  });

  it('should rollback state change if history creation fails in aprobar, rechazar and cancelar', async () => {
    // 1. Aprobar con fallo en historial
    const spyAprobar = jest
      .spyOn(HistorialReserva, 'create')
      .mockRejectedValueOnce(new Error('Fallo en BD al guardar historial'));

    const resAprobar = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/aprobar`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resAprobar.status).toBe(500);
    spyAprobar.mockRestore();

    const trasFalloAprobar = await Reserva.findByPk(reservaPendiente.id);
    expect(trasFalloAprobar.estado).toBe('pendiente');

    // 2. Rechazar con fallo en historial
    const spyRechazar = jest
      .spyOn(HistorialReserva, 'create')
      .mockRejectedValueOnce(new Error('Fallo en BD al guardar historial'));

    const resRechazar = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/rechazar`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resRechazar.status).toBe(500);
    spyRechazar.mockRestore();

    const trasFalloRechazar = await Reserva.findByPk(reservaPendiente.id);
    expect(trasFalloRechazar.estado).toBe('pendiente');

    // 3. Cancelar con fallo en historial
    const spyCancelar = jest
      .spyOn(HistorialReserva, 'create')
      .mockRejectedValueOnce(new Error('Fallo en BD al guardar historial'));

    const resCancelar = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/cancelar`)
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(resCancelar.status).toBe(500);
    spyCancelar.mockRestore();

    const trasFalloCancelar = await Reserva.findByPk(reservaPendiente.id);
    expect(trasFalloCancelar.estado).toBe('pendiente');
  });

  it('should return occupied time slots on GET /api/aulas/:id/disponibilidad', async () => {
    const fechaDisp = fechaFutura(1);

    // Agregamos una cancelada y una aprobada ese mismo día
    await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: fechaDisp,
      horaInicio: '08:00',
      horaFin: '09:00',
      cantidadPersonas: 5,
      motivo: 'Cancelada no debe figurar',
      estado: 'cancelada'
    });

    await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: fechaDisp,
      horaInicio: '18:00',
      horaFin: '20:00',
      cantidadPersonas: 10,
      motivo: 'Aprobada sí debe figurar',
      estado: 'aprobada'
    });

    // Sin token -> 401
    const sinToken = await request(app).get(`/api/aulas/${aula.id}/disponibilidad?fecha=${fechaDisp}`);
    expect(sinToken.status).toBe(401);

    // Aula inexistente -> 404
    const aulaInexistente = await request(app)
      .get(`/api/aulas/99999/disponibilidad?fecha=${fechaDisp}`)
      .set('Authorization', `Bearer ${usuarioToken}`);
    expect(aulaInexistente.status).toBe(404);

    // Fecha inválida -> 400
    const fechaInvalida = await request(app)
      .get(`/api/aulas/${aula.id}/disponibilidad?fecha=fecha-invalida`)
      .set('Authorization', `Bearer ${usuarioToken}`);
    expect(fechaInvalida.status).toBe(400);

    // Consulta válida -> 200 con franjas pendientes y aprobadas ordenadas
    const okRes = await request(app)
      .get(`/api/aulas/${aula.id}/disponibilidad?fecha=${fechaDisp}`)
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(okRes.status).toBe(200);
    expect(okRes.body).toEqual([
      { horaInicio: '10:00', horaFin: '12:00', estado: 'pendiente' },
      { horaInicio: '14:00', horaFin: '16:00', estado: 'pendiente' },
      { horaInicio: '18:00', horaFin: '20:00', estado: 'aprobada' }
    ]);
  });

  it('should map Sequelize FK and Unique constraint errors in manejadorErrores', () => {
    const crearResMock = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    };

    const resUnique = crearResMock();
    manejadorErrores(
      {
        name: 'SequelizeUniqueConstraintError',
        parent: { code: '23505', constraint: 'usuarios_email_key' },
        fields: { email: 'duplicado@test.com' }
      },
      {},
      resUnique,
      () => {}
    );
    expect(resUnique.status).toHaveBeenCalledWith(400);
    expect(resUnique.json).toHaveBeenCalledWith({ error: 'El email ya está registrado' });

    const resFkAula = crearResMock();
    manejadorErrores(
      {
        name: 'SequelizeForeignKeyConstraintError',
        parent: { code: '23503', constraint: 'reservas_aulaId_fkey' }
      },
      {},
      resFkAula,
      () => {}
    );
    expect(resFkAula.status).toHaveBeenCalledWith(404);
    expect(resFkAula.json).toHaveBeenCalledWith({ error: 'El aula solicitada no existe' });
  });
});
