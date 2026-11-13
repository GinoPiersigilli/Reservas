import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import Aula from '../src/models/aula.model.js';
import Reserva from '../src/models/reserva.model.js';
import HistorialAula from '../src/models/historialAula.model.js';
import HistorialReserva from '../src/models/historial.model.js';
import env from '../src/config/env.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

function fechaFutura(dias = 3) {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return f.toISOString().split('T')[0];
}

describe('Fase 10 — ABM y Ciclo de Vida de Aulas', () => {
  let adminUser;
  let normalUser;
  let adminToken;
  let normalToken;

  beforeEach(async () => {
    await limpiarBaseDeDatos();

    adminUser = await Usuario.create({
      nombre: 'Admin Bedelía',
      email: 'admin@utnfrc.edu.ar',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      rol: 'admin',
      activo: true
    });

    normalUser = await Usuario.create({
      nombre: 'Profesor Carlos',
      email: 'carlos@utnfrc.edu.ar',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      rol: 'usuario',
      activo: true
    });

    adminToken = jwt.sign(
      { id: adminUser.id, nombre: adminUser.nombre, email: adminUser.email, rol: 'admin' },
      env.JWT_SECRET,
      { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '2h' }
    );

    normalToken = jwt.sign(
      { id: normalUser.id, nombre: normalUser.nombre, email: normalUser.email, rol: 'usuario' },
      env.JWT_SECRET,
      { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '2h' }
    );
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('1. Control de Permisos y Acceso RBAC', () => {
    it('usuario común recibe 403 al intentar crear, editar, desactivar o reactivar aulas', async () => {
      const aula = await Aula.create({
        nombre: 'Aula 100',
        ubicacion: 'Pabellón A',
        capacidad: 30,
        activa: true
      });

      // POST /api/aulas
      const resPost = await request(app)
        .post('/api/aulas')
        .set('Authorization', `Bearer ${normalToken}`)
        .send({ nombre: 'Aula Nueva', ubicacion: 'Piso 1', capacidad: 20 });
      expect(resPost.status).toBe(403);
      expect(resPost.body.error).toMatch(/admin/i);

      // PUT /api/aulas/:id
      const resPut = await request(app)
        .put(`/api/aulas/${aula.id}`)
        .set('Authorization', `Bearer ${normalToken}`)
        .send({ capacidad: 35 });
      expect(resPut.status).toBe(403);

      // PATCH /api/aulas/:id/desactivar
      const resDesact = await request(app)
        .patch(`/api/aulas/${aula.id}/desactivar`)
        .set('Authorization', `Bearer ${normalToken}`)
        .send({});
      expect(resDesact.status).toBe(403);

      // PATCH /api/aulas/:id/reactivar
      const resReact = await request(app)
        .patch(`/api/aulas/${aula.id}/reactivar`)
        .set('Authorization', `Bearer ${normalToken}`)
        .send({});
      expect(resReact.status).toBe(403);
    });

    it('GET /api/aulas: usuario común solo ve activas incluso con ?incluirInactivas=true', async () => {
      await Aula.create({
        nombre: 'Aula Activa',
        ubicacion: 'Piso 1',
        capacidad: 30,
        activa: true
      });
      await Aula.create({
        nombre: 'Aula Inactiva',
        ubicacion: 'Piso 2',
        capacidad: 40,
        activa: false
      });

      const res = await request(app)
        .get('/api/aulas?incluirInactivas=true')
        .set('Authorization', `Bearer ${normalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].nombre).toBe('Aula Activa');
    });

    it('GET /api/aulas: admin ve todas cuando envía ?incluirInactivas=true', async () => {
      await Aula.create({
        nombre: 'Aula Activa',
        ubicacion: 'Piso 1',
        capacidad: 30,
        activa: true
      });
      await Aula.create({
        nombre: 'Aula Inactiva',
        ubicacion: 'Piso 2',
        capacidad: 40,
        activa: false
      });

      const res = await request(app)
        .get('/api/aulas?incluirInactivas=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });
  });

  describe('2. Validación de Reglas de Negocio y Límites', () => {
    it('crea aula exitosamente y escribe auditoría en historial_aulas', async () => {
      const res = await request(app)
        .post('/api/aulas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Laboratorio de Redes',
          ubicacion: 'Edificio Central - Piso 2',
          capacidad: 45,
          recursos: '20 PCs, proyector, switch cisco'
        });

      expect(res.status).toBe(201);
      expect(res.body.nombre).toBe('Laboratorio de Redes');
      expect(res.body.activa).toBe(true);

      const historial = await HistorialAula.findAll({ where: { aulaId: res.body.id } });
      expect(historial.length).toBe(1);
      expect(historial[0].accion).toBe('creacion');
      expect(historial[0].usuarioId).toBe(adminUser.id);
      expect(historial[0].valorNuevo.nombre).toBe('Laboratorio de Redes');
    });

    it('rechaza nombres duplicados insensible a mayúsculas y minúsculas con 409', async () => {
      await Aula.create({
        nombre: 'Aula Magna',
        ubicacion: 'Planta Baja',
        capacidad: 100,
        activa: true
      });

      const res = await request(app)
        .post('/api/aulas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'aula magna',
          ubicacion: 'Planta Baja',
          capacidad: 120
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/ya existe un aula con ese nombre/i);
    });

    it('rechaza capacidad menor a 1 o mayor a 1000', async () => {
      const resMenor = await request(app)
        .post('/api/aulas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nombre: 'Aula Cero', ubicacion: 'Piso 1', capacidad: 0 });
      expect(resMenor.status).toBe(400);

      const resMayor = await request(app)
        .post('/api/aulas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nombre: 'Aula Gigante', ubicacion: 'Piso 1', capacidad: 1001 });
      expect(resMayor.status).toBe(400);
    });

    it('rechaza ubicación que exceda los 120 caracteres', async () => {
      const res = await request(app)
        .post('/api/aulas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Aula Ubicacion Larga',
          ubicacion: 'A'.repeat(121),
          capacidad: 50
        });
      expect(res.status).toBe(400);
    });

    it('rechaza reducir capacidad por debajo del máximo de reservas futuras activas con 409', async () => {
      const aula = await Aula.create({
        nombre: 'Aula 205',
        ubicacion: 'Piso 2',
        capacidad: 50,
        activa: true
      });

      const fecha = fechaFutura(2);
      await Reserva.create({
        aulaId: aula.id,
        usuarioId: normalUser.id,
        fecha,
        horaInicio: '09:00',
        horaFin: '11:00',
        cantidadPersonas: 40,
        motivo: 'Examen de Algoritmos',
        estado: 'aprobada'
      });

      // Intentar reducir a 30 (menor a 40)
      const res = await request(app)
        .put(`/api/aulas/${aula.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ capacidad: 30 });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(
        /no se puede reducir la capacidad por debajo de las reservas futuras/i
      );
      expect(res.body.capacidadMaximaRequerida).toBe(40);
      expect(res.body.detalle).toBeDefined();

      // Permitir reducir a 45 (mayor o igual a 40)
      const resValido = await request(app)
        .put(`/api/aulas/${aula.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ capacidad: 45 });

      expect(resValido.status).toBe(200);
      expect(resValido.body.capacidad).toBe(45);
    });
  });

  describe('3. Desactivación y Reactivación de Aulas', () => {
    it('responde 409 con cantidad afectada si hay reservas futuras y no se confirma cancelación', async () => {
      const aula = await Aula.create({
        nombre: 'Aula de Física',
        ubicacion: 'Pabellón B',
        capacidad: 40,
        activa: true
      });

      const fecha = fechaFutura(4);
      await Reserva.create({
        aulaId: aula.id,
        usuarioId: normalUser.id,
        fecha,
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 25,
        motivo: 'Laboratorio de Ondas',
        estado: 'pendiente'
      });

      const res = await request(app)
        .patch(`/api/aulas/${aula.id}/desactivar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/reservas futuras activas/i);
      expect(res.body.reservasAfectadas).toBe(1);

      const aulaBD = await Aula.findByPk(aula.id);
      expect(aulaBD.activa).toBe(true);
    });

    it('desactiva aula y cancela reservas futuras atómicamente con motivo y auditoría', async () => {
      const aula = await Aula.create({
        nombre: 'Aula Con Reservas',
        ubicacion: 'Pabellón C',
        capacidad: 50,
        activa: true
      });

      const fecha = fechaFutura(5);
      const reserva = await Reserva.create({
        aulaId: aula.id,
        usuarioId: normalUser.id,
        fecha,
        horaInicio: '14:00',
        horaFin: '16:00',
        cantidadPersonas: 30,
        motivo: 'Clase Magistral',
        estado: 'aprobada'
      });

      const res = await request(app)
        .patch(`/api/aulas/${aula.id}/desactivar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cancelarReservasFuturas: true,
          motivo: 'Refacciones en el sistema eléctrico'
        });

      expect(res.status).toBe(200);
      expect(res.body.reservasCanceladas).toBe(1);

      // Aula desactivada
      const aulaBD = await Aula.findByPk(aula.id);
      expect(aulaBD.activa).toBe(false);

      // Reserva cancelada
      const reservaBD = await Reserva.findByPk(reserva.id);
      expect(reservaBD.estado).toBe('cancelada');

      // Auditoría en historial_reservas
      const histReserva = await HistorialReserva.findAll({ where: { reservaId: reserva.id } });
      expect(histReserva.length).toBe(1);
      expect(histReserva[0].accion).toMatch(/cancelad/i);
      expect(histReserva[0].valorNuevo.motivo).toMatch(/Refacciones en el sistema eléctrico/);

      // Auditoría en historial_aulas
      const histAula = await HistorialAula.findAll({ where: { aulaId: aula.id } });
      expect(histAula.length).toBe(1);
      expect(histAula[0].accion).toBe('desactivacion');
      expect(histAula[0].valorNuevo.motivo).toBe('Refacciones en el sistema eléctrico');
    });

    it('reactiva aula exitosamente y registra en historial_aulas', async () => {
      const aula = await Aula.create({
        nombre: 'Aula Inactiva Para Reactivar',
        ubicacion: 'Piso 3',
        capacidad: 25,
        activa: false
      });

      const res = await request(app)
        .patch(`/api/aulas/${aula.id}/reactivar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.activa).toBe(true);

      const histAula = await HistorialAula.findAll({ where: { aulaId: aula.id } });
      expect(histAula.length).toBe(1);
      expect(histAula[0].accion).toBe('reactivacion');
    });
  });

  describe('4. Inactividad, Disponibilidad y Bloqueo de Creación/Edición', () => {
    it('GET /api/aulas/:id/disponibilidad responde 400 si el aula está inactiva', async () => {
      const aula = await Aula.create({
        nombre: 'Aula Inactiva Disp',
        ubicacion: 'Piso 1',
        capacidad: 20,
        activa: false
      });

      const res = await request(app)
        .get(`/api/aulas/${aula.id}/disponibilidad?fecha=${fechaFutura(3)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/aula no está activa/i);
    });

    it('POST /api/reservas responde 400 si se intenta reservar en aula inactiva', async () => {
      const aula = await Aula.create({
        nombre: 'Aula Inactiva Res',
        ubicacion: 'Piso 1',
        capacidad: 20,
        activa: false
      });

      const res = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${normalToken}`)
        .send({
          aulaId: aula.id,
          fecha: fechaFutura(3),
          horaInicio: '10:00',
          horaFin: '12:00',
          cantidadPersonas: 10,
          motivo: 'Intento en aula inactiva'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/aula no está activa para nuevas reservas/i);
    });

    it('PUT /api/reservas/:id responde 400 si se intenta mover a un aula inactiva', async () => {
      const aulaActiva = await Aula.create({
        nombre: 'Aula Inicial',
        ubicacion: 'Piso 1',
        capacidad: 40,
        activa: true
      });

      const aulaInactiva = await Aula.create({
        nombre: 'Aula Destino Inactiva',
        ubicacion: 'Piso 2',
        capacidad: 40,
        activa: false
      });

      const reserva = await Reserva.create({
        aulaId: aulaActiva.id,
        usuarioId: normalUser.id,
        fecha: fechaFutura(4),
        horaInicio: '09:00',
        horaFin: '11:00',
        cantidadPersonas: 15,
        motivo: 'Clase regular',
        estado: 'pendiente'
      });

      const res = await request(app)
        .put(`/api/reservas/${reserva.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ aulaId: aulaInactiva.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/aula no está activa para nuevas reservas/i);
    });
  });

  describe('5. Inmutabilidad y Disparador Append-Only en historial_aulas', () => {
    it('el trigger de PostgreSQL rechaza UPDATE directo en historial_aulas', async () => {
      const aula = await Aula.create({
        nombre: 'Aula Auditada',
        ubicacion: 'Piso 1',
        capacidad: 25,
        activa: true
      });

      const registro = await HistorialAula.create({
        aulaId: aula.id,
        usuarioId: adminUser.id,
        accion: 'creacion',
        valorNuevo: { nombre: 'Aula Auditada' }
      });

      await expect(
        sequelize.query(`UPDATE historial_aulas SET accion = 'edicion' WHERE id = ${registro.id};`)
      ).rejects.toThrow(/append-only/i);
    });

    it('el trigger de PostgreSQL rechaza DELETE directo en historial_aulas', async () => {
      const aula = await Aula.create({
        nombre: 'Aula Auditada 2',
        ubicacion: 'Piso 1',
        capacidad: 25,
        activa: true
      });

      const registro = await HistorialAula.create({
        aulaId: aula.id,
        usuarioId: adminUser.id,
        accion: 'creacion',
        valorNuevo: { nombre: 'Aula Auditada 2' }
      });

      await expect(
        sequelize.query(`DELETE FROM historial_aulas WHERE id = ${registro.id};`)
      ).rejects.toThrow(/append-only/i);
    });

    it('si falla la inserción en historial_aulas se hace rollback de la creación del aula', async () => {
      // Intentamos crear con un espía que haga fallar HistorialAula.create
      const spy = jest
        .spyOn(HistorialAula, 'create')
        .mockRejectedValueOnce(new Error('Fallo simulado en auditoría'));

      const res = await request(app)
        .post('/api/aulas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Aula Que Falla',
          ubicacion: 'Piso 1',
          capacidad: 20
        });

      spy.mockRestore();

      expect(res.status).toBe(500);

      // Verificamos que no quedó el aula creada en la base de datos
      const aulaBD = await Aula.findOne({ where: { nombre: 'Aula Que Falla' } });
      expect(aulaBD).toBeNull();
    });
  });

  describe('6. Concurrencia y Condición de Carrera (FOR SHARE vs FOR UPDATE)', () => {
    it('garantiza que la creación simultánea de reserva y baja de aula no deje reservas huérfanas en aula inactiva', async () => {
      const aula = await Aula.create({
        nombre: 'Aula Carrera',
        ubicacion: 'Piso 4',
        capacidad: 50,
        activa: true
      });

      const fecha = fechaFutura(6);

      // Lanzar simultáneamente:
      // 1) Crear reserva
      // 2) Desactivar aula
      const peticionCrear = request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${normalToken}`)
        .send({
          aulaId: aula.id,
          fecha,
          horaInicio: '10:00',
          horaFin: '12:00',
          cantidadPersonas: 20,
          motivo: 'Reserva concurrente'
        });

      const peticionDesactivar = request(app)
        .patch(`/api/aulas/${aula.id}/desactivar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cancelarReservasFuturas: true,
          motivo: 'Baja concurrente de prueba'
        });

      const [resCrear, resDesact] = await Promise.all([peticionCrear, peticionDesactivar]);
      expect([200, 201, 400, 409]).toContain(resCrear.status);
      expect([200, 409]).toContain(resDesact.status);

      // Estados posibles debido al bloqueo:
      // Caso A: La reserva se creó primero -> la desactivación la detecta y la cancela (o si sin confirmación falla 409).
      // Caso B: La baja se procesó primero -> la reserva falla con 400 (aula inactiva).
      // En NINGÚN caso debe quedar el aula inactiva con la reserva en estado 'pendiente' o 'aprobada'.
      const aulaFinal = await Aula.findByPk(aula.id);
      const reservasActivas = await Reserva.findAll({
        where: {
          aulaId: aula.id,
          estado: ['pendiente', 'aprobada']
        }
      });

      if (!aulaFinal.activa) {
        expect(reservasActivas.length).toBe(0);
      }
    });
  });
});
