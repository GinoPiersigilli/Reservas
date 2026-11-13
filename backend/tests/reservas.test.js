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
import { hoyArgentina, horaActualArgentina, esHorarioPasado } from '../src/utils/fecha.js';
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
let admin;
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

  admin = await Usuario.create({
    nombre: 'Admin Test',
    email: 'admin@test.com',
    passwordHash,
    rol: 'admin',
    activo: true
  });
  usuario = await Usuario.create({
    nombre: 'User Test A',
    email: 'user@test.com',
    passwordHash,
    rol: 'usuario',
    activo: true
  });
  otroUsuario = await Usuario.create({
    nombre: 'User Test B',
    email: 'userb@test.com',
    passwordHash,
    rol: 'usuario',
    activo: true
  });

  adminToken = jwt.sign(
    { id: admin.id, nombre: admin.nombre, email: admin.email, rol: admin.rol },
    env.JWT_SECRET,
    { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
  );
  usuarioToken = jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    env.JWT_SECRET,
    { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
  );
  otroUsuarioToken = jwt.sign(
    {
      id: otroUsuario.id,
      nombre: otroUsuario.nombre,
      email: otroUsuario.email,
      rol: otroUsuario.rol
    },
    env.JWT_SECRET,
    { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
  );

  aula = await Aula.create({
    nombre: 'Aula de Prueba',
    ubicacion: 'Piso 1',
    capacidad: 20,
    recursos: 'pizarra',
    activa: true
  });

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
    expect(responseOtroUsuario.body).toHaveProperty(
      'error',
      'No tienes permiso para cancelar esta reserva'
    );

    const tokenRolDesconocido = jwt.sign(
      { id: usuario.id, nombre: 'Invitado', email: 'invitado@test.com', rol: 'invitado' },
      env.JWT_SECRET,
      { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
    );

    const responseRolDesconocido = await request(app)
      .patch(`/api/reservas/${reservaOtroUsuario.id}/cancelar`)
      .set('Authorization', `Bearer ${tokenRolDesconocido}`);

    expect(responseRolDesconocido.status).toBe(403);
    expect(responseRolDesconocido.body).toHaveProperty(
      'error',
      'No tienes permiso para cancelar esta reserva'
    );
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

  describe('SEC-VAL-01: validación de parámetros de ruta :id con Zod', () => {
    it('rejects non-integer id with 400 on GET /api/reservas/:id', async () => {
      const response = await request(app)
        .get('/api/reservas/invalido')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'El id debe ser un número entero mayor a 0');
    });

    it('rejects non-positive id <= 0 with 400 on GET /api/reservas/:id', async () => {
      const resCero = await request(app)
        .get('/api/reservas/0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resCero.status).toBe(400);
      expect(resCero.body).toHaveProperty('error', 'El id debe ser un número entero mayor a 0');

      const resNegativo = await request(app)
        .get('/api/reservas/-4')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resNegativo.status).toBe(400);
      expect(resNegativo.body).toHaveProperty('error', 'El id debe ser un número entero mayor a 0');
    });

    it('rejects invalid id with 400 on GET /api/aulas/:id/disponibilidad', async () => {
      const response = await request(app)
        .get('/api/aulas/no-es-numero/disponibilidad?fecha=2026-11-20')
        .set('Authorization', `Bearer ${usuarioToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'El id debe ser un número entero mayor a 0');
    });
  });

  describe('SEC-VAL-01: validación de query params en GET /api/reservas con Zod', () => {
    it('rejects invalid fecha format in query with 400', async () => {
      const response = await request(app)
        .get('/api/reservas?fecha=2026-13-45')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'La fecha debe tener un formato válido YYYY-MM-DD'
      );
    });

    it('rejects invalid estado in query with 400', async () => {
      const response = await request(app)
        .get('/api/reservas?estado=estado_inexistente')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'El estado no es válido');
    });

    it('rejects invalid page in query with 400', async () => {
      const response = await request(app)
        .get('/api/reservas?page=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'La página debe ser un número entero mayor a 0'
      );
    });

    it('rejects invalid aulaId in query with 400', async () => {
      const response = await request(app)
        .get('/api/reservas?aulaId=no-es-numero')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'El aulaId debe ser un número entero válido');
    });
  });

  describe('Compatibilidad de contrato con frontend: GET /api/reservas con parámetros vacíos o inválidos', () => {
    it('responde 200 para admin con exactamente los parámetros del frontend con filtros vacíos', async () => {
      const response = await request(app)
        .get('/api/reservas?fecha=&estado=&aulaId=&q=&page=1&limit=10&sortBy=createdAt&order=DESC')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('datos');
      expect(response.body).toHaveProperty('total');
      expect(response.body.pagina).toBe(1);
    });

    it('responde 200 para usuario con exactamente los parámetros del frontend con filtros vacíos', async () => {
      const response = await request(app)
        .get('/api/reservas?fecha=&estado=&aulaId=&q=&page=1&limit=10&sortBy=createdAt&order=DESC')
        .set('Authorization', `Bearer ${usuarioToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('datos');
      expect(response.body).toHaveProperty('total');
      expect(response.body.pagina).toBe(1);
    });

    it('responde 200 con cada filtro individual con valor', async () => {
      const resFecha = await request(app)
        .get(`/api/reservas?fecha=${fechaFutura(1)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resFecha.status).toBe(200);

      const resEstado = await request(app)
        .get('/api/reservas?estado=pendiente')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resEstado.status).toBe(200);

      const resAula = await request(app)
        .get(`/api/reservas?aulaId=${aula.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAula.status).toBe(200);

      const resQ = await request(app)
        .get('/api/reservas?q=consulta')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resQ.status).toBe(200);
    });

    it('responde 200 con los valores por defecto ante sortBy y order inválidos, no 400', async () => {
      const response = await request(app)
        .get('/api/reservas?sortBy=columnaInexistente&order=direccionInvalida')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('datos');
    });

    it('responde 400 con fecha mal formada', async () => {
      const response = await request(app)
        .get('/api/reservas?fecha=2026-13-45')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'La fecha debe tener un formato válido YYYY-MM-DD'
      );
    });
  });

  describe('SEC-VAL-01: validación de cuerpo en POST y PUT /api/reservas con Zod', () => {
    it('rejects POST /api/reservas with float cantidadPersonas with 400', async () => {
      const response = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${usuarioToken}`)
        .send({
          aulaId: aula.id,
          fecha: fechaFutura(3),
          horaInicio: '10:00',
          horaFin: '12:00',
          cantidadPersonas: 15.5,
          motivo: 'Reunion con float'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'La cantidad de personas debe ser un número entero mayor a 0'
      );
    });

    it('rejects PUT /api/reservas/:id with non-positive aulaId with 400', async () => {
      const response = await request(app)
        .put(`/api/reservas/${reservaPendiente.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ aulaId: 0 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'El aulaId debe ser un número entero válido');
    });

    it('rejects PUT /api/reservas/:id with motivo exceeding 255 characters with 400', async () => {
      const response = await request(app)
        .put(`/api/reservas/${reservaPendiente.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ motivo: 'A'.repeat(256) });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'El motivo no puede superar los 255 caracteres'
      );
    });
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
    expect(response.body).toHaveProperty(
      'error',
      'La cantidad de personas supera la capacidad del aula'
    );
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

    expect(response.status).toBe(409);
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

    expect(response.status).toBe(409);
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
    const rechazadas = respuestas.filter((r) => r.status === 409);

    expect(creadas).toHaveLength(1);
    expect(rechazadas).toHaveLength(9);
    rechazadas.forEach((r) => {
      expect(r.body).toHaveProperty('error', 'El aula ya está reservada en ese horario');
    });

    const totalEnBd = await Reserva.count({
      where: { aulaId: aula.id, fecha: fechaConcurrente }
    });
    expect(totalEnBd).toBe(1);
  }, 15000);

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

      expect(response.status).toBe(409);
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
        { id: admin.id, nombre: admin.nombre, email: admin.email, rol: admin.rol },
        env.JWT_SECRET,
        { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
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
    const sinToken = await request(app).get(
      `/api/aulas/${aula.id}/disponibilidad?fecha=${fechaDisp}`
    );
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
    expect(resUnique.status).toHaveBeenCalledWith(409);
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

  // ==========================================
  // TESTS FASE 4 — COBERTURA DE REGLAS DE NEGOCIO
  // ==========================================

  it('should require authentication on GET /api/aulas (SEC-INV-01) and list only active classrooms', async () => {
    await Aula.create({
      nombre: 'Aula Inactiva X',
      ubicacion: 'Subsuelo',
      capacidad: 25,
      recursos: 'pizarra',
      activa: false
    });

    const responseSinToken = await request(app).get('/api/aulas');
    expect(responseSinToken.status).toBe(401);
    expect(responseSinToken.body).toHaveProperty('error', 'Token no informado');

    const responseConToken = await request(app)
      .get('/api/aulas')
      .set('Authorization', `Bearer ${usuarioToken}`);
    expect(responseConToken.status).toBe(200);
    expect(Array.isArray(responseConToken.body)).toBe(true);
    expect(responseConToken.body.some((a) => a.id === aula.id)).toBe(true);
    expect(responseConToken.body.every((a) => a.activa === true)).toBe(true);
  });

  it('should validate all creation business rules (missing fields, non-existent/inactive aula, working hours, start<end, history)', async () => {
    const fecha = fechaFutura(3);

    // 1. Campos obligatorios faltantes
    const resFaltantes = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({ aulaId: aula.id });
    expect(resFaltantes.status).toBe(400);
    expect(resFaltantes.body.error).toMatch(/Faltan campos obligatorios/i);

    // 2. Aula inexistente -> 404
    const resAulaNoExiste = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: 99999,
        fecha,
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 10,
        motivo: 'Aula inexistente'
      });
    expect(resAulaNoExiste.status).toBe(404);
    expect(resAulaNoExiste.body).toHaveProperty('error', 'El aula solicitada no existe');

    // 3. Aula inactiva -> 400
    const aulaInactiva = await Aula.create({
      nombre: 'Aula Cerrada',
      ubicacion: 'Piso 3',
      capacidad: 30,
      recursos: 'pizarra',
      activa: false
    });
    const resAulaInactiva = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aulaInactiva.id,
        fecha,
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 10,
        motivo: 'Reserva en aula inactiva'
      });
    expect(resAulaInactiva.status).toBe(400);
    expect(resAulaInactiva.body.error).toMatch(/no está activa/i);

    // 4. horaInicio >= horaFin -> 400
    const resHoraInvertida = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha,
        horaInicio: '14:00',
        horaFin: '12:00',
        cantidadPersonas: 10,
        motivo: 'Horario invertido'
      });
    expect(resHoraInvertida.status).toBe(400);
    expect(resHoraInvertida.body).toHaveProperty(
      'error',
      'La hora de inicio debe ser menor a la hora de fin'
    );

    // 5. Fuera de horario laboral (08:00 a 22:00) -> 400
    const resTemprano = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha,
        horaInicio: '07:00',
        horaFin: '09:00',
        cantidadPersonas: 10,
        motivo: 'Antes de las 08:00'
      });
    expect(resTemprano.status).toBe(400);
    expect(resTemprano.body).toHaveProperty(
      'error',
      'Las reservas solo se permiten entre las 08:00 y las 22:00'
    );

    const resTarde = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha,
        horaInicio: '21:00',
        horaFin: '22:30',
        cantidadPersonas: 10,
        motivo: 'Después de las 22:00'
      });
    expect(resTarde.status).toBe(400);
    expect(resTarde.body).toHaveProperty(
      'error',
      'Las reservas solo se permiten entre las 08:00 y las 22:00'
    );

    // 6. Creación válida registra historial con accion 'creacion'
    const resValida = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha,
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 12,
        motivo: 'Creación con historial'
      });
    expect(resValida.status).toBe(201);

    const resHistorial = await request(app)
      .get(`/api/reservas/${resValida.body.id}/historial`)
      .set('Authorization', `Bearer ${usuarioToken}`);
    expect(resHistorial.status).toBe(200);
    expect(resHistorial.body).toHaveLength(1);
    expect(resHistorial.body[0]).toMatchObject({
      accion: 'creacion',
      valorAnterior: null,
      valorNuevo: { estado: 'pendiente' }
    });

    // El historial nombra a quien hizo el cambio: un registro que dice
    // "Usuario #4" no sirve para auditar. El correo no viaja: esta respuesta
    // la ve también quien pidió la reserva.
    expect(resHistorial.body[0].usuario).toMatchObject({
      id: usuario.id,
      nombre: 'User Test A'
    });
    expect(resHistorial.body[0].usuario).not.toHaveProperty('email');
  });

  it('should cover complete state transition flow, role permissions, and history entries', async () => {
    const fecha = fechaFutura(4);

    // Usuario común no puede rechazar ni editar ni ver resumen -> 403
    const resRechazarUsuario = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/rechazar`)
      .set('Authorization', `Bearer ${usuarioToken}`);
    expect(resRechazarUsuario.status).toBe(403);

    const resEditarUsuario = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({ motivo: 'Intento usuario' });
    expect(resEditarUsuario.status).toBe(403);

    const resResumenUsuario = await request(app)
      .get('/api/reservas/resumen')
      .set('Authorization', `Bearer ${usuarioToken}`);
    expect(resResumenUsuario.status).toBe(403);

    // 1. pendiente -> aprobada (solo admin) + luego aprobada -> cancelada (admin o propietario)
    const resAprobar = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/aprobar`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAprobar.status).toBe(200);
    expect(resAprobar.body.estado).toBe('aprobada');

    // No se puede rechazar una aprobada
    const resRechazarAprobada = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/rechazar`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resRechazarAprobada.status).toBe(400);
    expect(resRechazarAprobada.body).toHaveProperty(
      'error',
      'Solo se pueden rechazar reservas pendientes'
    );

    // aprobada -> cancelada por el propietario
    const resCancelarAprobada = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/cancelar`)
      .set('Authorization', `Bearer ${usuarioToken}`);
    expect(resCancelarAprobada.status).toBe(200);
    expect(resCancelarAprobada.body.estado).toBe('cancelada');

    // No se puede volver a cancelar una cancelada
    const resReCancelar = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/cancelar`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resReCancelar.status).toBe(400);
    expect(resReCancelar.body).toHaveProperty(
      'error',
      'Solo se pueden cancelar reservas pendientes o aprobadas'
    );

    // 2. pendiente -> rechazada (admin) y verificar que rechazada no puede cambiar ni bloquea horario
    const resParaRechazar = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha,
        horaInicio: '15:00',
        horaFin: '17:00',
        cantidadPersonas: 10,
        motivo: 'Reserva a rechazar'
      });
    expect(resParaRechazar.status).toBe(201);

    const resRechazar = await request(app)
      .patch(`/api/reservas/${resParaRechazar.body.id}/rechazar`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resRechazar.status).toBe(200);
    expect(resRechazar.body.estado).toBe('rechazada');

    // rechazada -> no puede aprobarse, rechazarse ni cancelarse
    const resAprobarRechazada = await request(app)
      .patch(`/api/reservas/${resParaRechazar.body.id}/aprobar`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAprobarRechazada.status).toBe(400);

    const resCancelarRechazada = await request(app)
      .patch(`/api/reservas/${resParaRechazar.body.id}/cancelar`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resCancelarRechazada.status).toBe(400);

    // rechazada no bloquea disponibilidad en el mismo horario
    const resSobreRechazada = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${otroUsuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha,
        horaInicio: '15:00',
        horaFin: '17:00',
        cantidadPersonas: 10,
        motivo: 'Nueva reserva sobre rechazada'
      });
    expect(resSobreRechazada.status).toBe(201);

    // 404 en acciones sobre reserva inexistente
    const resAprobar404 = await request(app)
      .patch('/api/reservas/99999/aprobar')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAprobar404.status).toBe(404);

    const resRechazar404 = await request(app)
      .patch('/api/reservas/99999/rechazar')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resRechazar404.status).toBe(404);

    const resCancelar404 = await request(app)
      .patch('/api/reservas/99999/cancelar')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resCancelar404.status).toBe(404);
  });

  it('should validate all edit reservation rules (self-overlap exclusion, cancelled/rejected block, history)', async () => {
    // 1. Editar la propia reserva desplazando dentro de su propio horario no genera auto-conflicto
    const resEditOk = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        horaInicio: '10:30',
        horaFin: '11:30',
        cantidadPersonas: 15,
        motivo: 'Motivo editado por admin'
      });
    expect(resEditOk.status).toBe(200);
    expect(resEditOk.body.horaInicio).toBe('10:30');
    expect(resEditOk.body.horaFin).toBe('11:30');
    expect(resEditOk.body.cantidadPersonas).toBe(15);
    expect(resEditOk.body.motivo).toBe('Motivo editado por admin');

    // Verificar registro de edición en historial
    const resHist = await request(app)
      .get(`/api/reservas/${reservaPendiente.id}/historial`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resHist.status).toBe(200);
    expect(resHist.body.some((h) => h.accion === 'edicion')).toBe(true);

    // 2. Validaciones de horario y capacidad en edición
    const resEditHoraInv = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ horaInicio: '15:00', horaFin: '14:00' });
    expect(resEditHoraInv.status).toBe(400);

    const resEditFueraHorario = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ horaInicio: '07:00', horaFin: '09:00' });
    expect(resEditFueraHorario.status).toBe(400);

    const resEditCapacidad = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cantidadPersonas: 999 });
    expect(resEditCapacidad.status).toBe(400);

    const resEditAula404 = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ aulaId: 99999 });
    expect(resEditAula404.status).toBe(404);

    const resEditReserva404 = await request(app)
      .put('/api/reservas/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ motivo: 'No existe' });
    expect(resEditReserva404.status).toBe(404);

    // 3. No se puede editar una reserva cancelada o rechazada
    await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/cancelar`)
      .set('Authorization', `Bearer ${adminToken}`);

    const resEditCancelada = await request(app)
      .put(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ motivo: 'Intento editar cancelada' });
    expect(resEditCancelada.status).toBe(400);
    expect(resEditCancelada.body).toHaveProperty(
      'error',
      'No se puede editar una reserva cancelada o rechazada'
    );
  });

  it('should filter by fecha, aulaId, estado, q and paginate results on GET /api/reservas', async () => {
    const fechaFiltro = fechaFutura(10);
    const otraAula = await Aula.create({
      nombre: 'Aula Filtro 2',
      ubicacion: 'Piso 2',
      capacidad: 40,
      recursos: 'proyector',
      activa: true
    });

    await Reserva.create({
      aulaId: otraAula.id,
      usuarioId: usuario.id,
      fecha: fechaFiltro,
      horaInicio: '09:00',
      horaFin: '11:00',
      cantidadPersonas: 15,
      motivo: 'Seminario Especial de Inteligencia Artificial',
      estado: 'aprobada'
    });

    const resPorQ = await request(app)
      .get(
        `/api/reservas?q=Inteligencia&fecha=${fechaFiltro}&aulaId=${otraAula.id}&estado=aprobada`
      )
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resPorQ.status).toBe(200);
    expect(resPorQ.body.total).toBe(1);
    expect(resPorQ.body.datos[0].motivo).toContain('Inteligencia Artificial');

    // Paginación: page 1 y page 2 con limit=1
    const resPag1 = await request(app)
      .get('/api/reservas?page=1&limit=1&sortBy=id&order=ASC')
      .set('Authorization', `Bearer ${adminToken}`);
    const resPag2 = await request(app)
      .get('/api/reservas?page=2&limit=1&sortBy=id&order=ASC')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resPag1.status).toBe(200);
    expect(resPag2.status).toBe(200);
    expect(resPag1.body.datos).toHaveLength(1);
    expect(resPag2.body.datos).toHaveLength(1);
    expect(resPag1.body.datos[0].id).not.toBe(resPag2.body.datos[0].id);
  });

  describe('Fase 3b-6: Visibilidad de solicitante para admin y protección de datos', () => {
    it('(a) no response from /api/reservas, /api/reservas/:id or /api/reservas/resumen contains "passwordHash" or "password"', async () => {
      const resListado = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resListado.status).toBe(200);
      expect(resListado.text).not.toContain('passwordHash');
      expect(resListado.text).not.toContain('password');

      const resDetalle = await request(app)
        .get(`/api/reservas/${reservaPendiente.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resDetalle.status).toBe(200);
      expect(resDetalle.text).not.toContain('passwordHash');
      expect(resDetalle.text).not.toContain('password');

      const resResumen = await request(app)
        .get('/api/reservas/resumen')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resResumen.status).toBe(200);
      expect(resResumen.text).not.toContain('passwordHash');
      expect(resResumen.text).not.toContain('password');
    });

    it('(b) admin receives usuario.nombre and usuario.email in list, detail, and summary', async () => {
      // Listado: admin ve solicitante con nombre y email
      const resListado = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resListado.status).toBe(200);
      const reservaA = resListado.body.datos.find((r) => r.id === reservaPendiente.id);
      expect(reservaA).toBeDefined();
      expect(reservaA.usuario).toEqual({
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      });

      // Detalle: admin ve solicitante con nombre y email
      const resDetalle = await request(app)
        .get(`/api/reservas/${reservaPendiente.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resDetalle.status).toBe(200);
      expect(resDetalle.body.usuario).toEqual({
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      });

      // Resumen: proximasHoy incluye usuario con nombre y email
      const fechaHoy = hoyArgentina();
      const reservaHoy = await Reserva.create({
        aulaId: aula.id,
        usuarioId: usuario.id,
        fecha: fechaHoy,
        horaInicio: '23:30',
        horaFin: '23:59',
        cantidadPersonas: 5,
        motivo: 'Revisión nocturna',
        estado: 'aprobada'
      });

      const resResumen = await request(app)
        .get('/api/reservas/resumen')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resResumen.status).toBe(200);
      const itemHoy = resResumen.body.proximasHoy.find((r) => r.id === reservaHoy.id);
      expect(itemHoy).toBeDefined();
      expect(itemHoy.usuario).toEqual({
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      });
    });

    it('(c) regular user does NOT receive usuario field and only sees own reservations', async () => {
      // Listado usuario común
      const resListado = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${usuarioToken}`);
      expect(resListado.status).toBe(200);
      // Solo ve sus reservas
      expect(resListado.body.datos.length).toBeGreaterThan(0);
      expect(resListado.body.datos.every((r) => r.usuarioId === usuario.id)).toBe(true);
      expect(resListado.body.datos.some((r) => r.id === reservaOtroUsuario.id)).toBe(false);
      // No incluye el campo usuario
      resListado.body.datos.forEach((r) => {
        expect(r.usuario).toBeUndefined();
      });

      // Detalle usuario común (propia reserva)
      const resDetalle = await request(app)
        .get(`/api/reservas/${reservaPendiente.id}`)
        .set('Authorization', `Bearer ${usuarioToken}`);
      expect(resDetalle.status).toBe(200);
      expect(resDetalle.body.id).toBe(reservaPendiente.id);
      expect(resDetalle.body.usuario).toBeUndefined();
    });

    it('(d) availability endpoint does not contain nombre or email', async () => {
      const fechaManiana = fechaFutura(1);
      const resDisp = await request(app)
        .get(`/api/aulas/${aula.id}/disponibilidad?fecha=${fechaManiana}`)
        .set('Authorization', `Bearer ${usuarioToken}`);

      expect(resDisp.status).toBe(200);
      expect(Array.isArray(resDisp.body)).toBe(true);
      expect(resDisp.body.length).toBeGreaterThan(0);
      expect(resDisp.body[0]).toHaveProperty('horaInicio');
      expect(resDisp.body[0]).toHaveProperty('horaFin');
      expect(resDisp.body[0]).toHaveProperty('estado');
      // No expone datos personales
      expect(resDisp.text).not.toContain('nombre');
      expect(resDisp.text).not.toContain('email');
      expect(resDisp.text).not.toContain(usuario.nombre);
      expect(resDisp.text).not.toContain(usuario.email);
    });
  });

  describe('Fase 9 — Validación de Horarios Intradiarios Pasados (esHorarioPasado)', () => {
    it('debe rechazar correctamente fechas pasadas y horarios ya transcurridos del día de hoy en la función de utilidad', () => {
      // 14:30 en Córdoba (UTC-3) -> 17:30 UTC
      const instante1430 = new Date('2026-11-10T17:30:00.000Z');
      const fechaHoy = hoyArgentina(instante1430);

      // Fecha pasada siempre es horario pasado
      expect(esHorarioPasado('2026-11-09', '10:00', instante1430)).toBe(true);

      // Mismo día pero horario anterior (10:00 vs 14:30)
      expect(esHorarioPasado(fechaHoy, '10:00', instante1430)).toBe(true);
      expect(esHorarioPasado(fechaHoy, '14:30', instante1430)).toBe(true);

      // Mismo día pero horario posterior (15:00 vs 14:30)
      expect(esHorarioPasado(fechaHoy, '15:00', instante1430)).toBe(false);
      expect(esHorarioPasado(fechaHoy, '18:00', instante1430)).toBe(false);

      // Fecha futura nunca es horario pasado
      expect(esHorarioPasado('2026-11-11', '08:00', instante1430)).toBe(false);
    });

    it('debe rechazar con 400 una reserva para hoy en un horario que ya transcurrió en POST /api/reservas', async () => {
      const [anio, mes, dia] = hoyArgentina().split('-').map(Number);
      // 14:00 en UTC-3 = 17:00 UTC
      const instante14hs = new Date(Date.UTC(anio, mes - 1, dia, 17, 0, 0));

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
      jest.setSystemTime(instante14hs);

      try {
        const tokenUsuario14hs = jwt.sign(
          { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
          env.JWT_SECRET,
          { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
        );

        const fechaHoy = hoyArgentina();

        // Intento de reservar de 09:00 a 10:00 hoy (ya son las 14:00)
        const res = await request(app)
          .post('/api/reservas')
          .set('Authorization', `Bearer ${tokenUsuario14hs}`)
          .send({
            aulaId: aula.id,
            fecha: fechaHoy,
            horaInicio: '09:00',
            horaFin: '10:00',
            cantidadPersonas: 5,
            motivo: 'Intento de reserva en horario pasado de hoy'
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/horarios que ya han transcurrido/i);

        // Reserva futura de hoy (15:00 a 16:00 cuando son las 14:00) debe proceder
        const resValida = await request(app)
          .post('/api/reservas')
          .set('Authorization', `Bearer ${tokenUsuario14hs}`)
          .send({
            aulaId: aula.id,
            fecha: fechaHoy,
            horaInicio: '15:00',
            horaFin: '16:00',
            cantidadPersonas: 5,
            motivo: 'Reserva válida para la tarde de hoy'
          });

        expect(resValida.status).toBe(201);
        expect(resValida.body.estado).toBe('pendiente');
      } finally {
        jest.useRealTimers();
      }
    });

    it('debe rechazar con 400 la edición a un horario pasado de hoy en PUT /api/reservas/:id', async () => {
      const [anio, mes, dia] = hoyArgentina().split('-').map(Number);
      const instante14hs = new Date(Date.UTC(anio, mes - 1, dia, 17, 0, 0));

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
      jest.setSystemTime(instante14hs);

      try {
        const tokenAdmin14hs = jwt.sign(
          { id: admin.id, nombre: admin.nombre, email: admin.email, rol: admin.rol },
          env.JWT_SECRET,
          { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
        );

        const fechaHoy = hoyArgentina();

        const res = await request(app)
          .put(`/api/reservas/${reservaPendiente.id}`)
          .set('Authorization', `Bearer ${tokenAdmin14hs}`)
          .send({
            fecha: fechaHoy,
            horaInicio: '08:00',
            horaFin: '09:00'
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/horarios que ya han transcurrido/i);
      } finally {
        jest.useRealTimers();
      }
    });

    it.each(['03:00', '11:00', '20:00'])(
      'debe ser independiente del horario simulado del reloj real (%s)',
      async (horaInicialStr) => {
        const [anio, mes, dia] = hoyArgentina().split('-').map(Number);
        const [hInit, mInit] = horaInicialStr.split(':').map(Number);
        // Simulamos que el reloj "real" antes de entrar al test era horaInicialStr en Córdoba (UTC-3 -> UTC = hInit + 3)
        const instanteInicial = new Date(Date.UTC(anio, mes - 1, dia, hInit + 3, mInit, 0));

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
        jest.setSystemTime(instanteInicial);

        // Simulamos un cambio a las 14:00 dentro de la prueba intradiaria
        const instante14hs = new Date(Date.UTC(anio, mes - 1, dia, 17, 0, 0));
        jest.setSystemTime(instante14hs);

        try {
          const tokenValido14hs = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
            env.JWT_SECRET,
            { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
          );

          const res = await request(app)
            .post('/api/reservas')
            .set('Authorization', `Bearer ${tokenValido14hs}`)
            .send({
              aulaId: aula.id,
              fecha: hoyArgentina(),
              horaInicio: '09:00',
              horaFin: '10:00',
              cantidadPersonas: 5,
              motivo: `Test horario pasado bajo reloj simulado ${horaInicialStr}`
            });

          expect(res.status).toBe(400);
          expect(res.body.error).toMatch(/horarios que ya han transcurrido/i);
        } finally {
          jest.useRealTimers();
        }
      }
    );
  });
});
