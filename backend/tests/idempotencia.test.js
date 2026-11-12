import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import Aula from '../src/models/aula.model.js';
import Reserva from '../src/models/reserva.model.js';
import IdempotencyKey from '../src/models/idempotencyKey.model.js';
import { purgarClavesVencidas } from '../src/services/idempotencia.services.js';
import env from '../src/config/env.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

function fechaFutura(dias = 5) {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return f.toISOString().split('T')[0];
}

describe('Fase 11 — Idempotencia en Creación de Reservas (POST /api/reservas)', () => {
  let user1;
  let user2;
  let token1;
  let token2;
  let aula1;
  let aula2;

  beforeAll(async () => {
    await limpiarBaseDeDatos();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos();

    user1 = await Usuario.create({
      nombre: 'Docente Juan',
      email: 'juan@utnfrc.edu.ar',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      rol: 'usuario',
      activo: true
    });

    user2 = await Usuario.create({
      nombre: 'Docente Maria',
      email: 'maria@utnfrc.edu.ar',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      rol: 'usuario',
      activo: true
    });

    token1 = jwt.sign(
      { id: user1.id, nombre: user1.nombre, email: user1.email, rol: 'usuario' },
      env.JWT_SECRET,
      { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
    );

    token2 = jwt.sign(
      { id: user2.id, nombre: user2.nombre, email: user2.email, rol: 'usuario' },
      env.JWT_SECRET,
      { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
    );

    aula1 = await Aula.create({
      nombre: 'Aula 301',
      ubicacion: 'Pabellón Central',
      capacidad: 40,
      activa: true
    });

    aula2 = await Aula.create({
      nombre: 'Laboratorio Info',
      ubicacion: 'Pabellón Sistemas',
      capacidad: 30,
      activa: true
    });
  });

  it('1. Misma clave dos veces seguidas -> una sola reserva con la misma respuesta y header Idempotent-Replay', async () => {
    const key = crypto.randomUUID();
    const payload = {
      aulaId: aula1.id,
      fecha: fechaFutura(3),
      horaInicio: '09:00',
      horaFin: '11:00',
      cantidadPersonas: 25,
      motivo: 'Clase de Paradigmas de Programación'
    };

    // Primer pedido
    const res1 = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.headers['idempotent-replay']).toBeUndefined();
    expect(res1.body).toHaveProperty('id');
    const reservaId = res1.body.id;

    // Segundo pedido con la misma clave y payload
    const res2 = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res2.status).toBe(201);
    expect(res2.headers['idempotent-replay']).toBe('true');
    expect(res2.body.id).toBe(reservaId);
    expect(res2.body.motivo).toBe(payload.motivo);

    // Verificar en la BD que existe exactamente UNA sola reserva
    const totalReservas = await Reserva.count({ where: { aulaId: aula1.id } });
    expect(totalReservas).toBe(1);
  });

  it('2. Misma clave en 10 pedidos simultáneos -> exactamente una reserva y todas con el mismo id', async () => {
    const key = crypto.randomUUID();
    const payload = {
      aulaId: aula1.id,
      fecha: fechaFutura(4),
      horaInicio: '14:00',
      horaFin: '16:00',
      cantidadPersonas: 20,
      motivo: 'Examen de Sistemas Operativos'
    };

    // 10 pedidos concurrentes con Promise.all
    const promesas = Array.from({ length: 10 }).map(() =>
      request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${token1}`)
        .set('Idempotency-Key', key)
        .send(payload)
    );

    const respuestas = await Promise.all(promesas);

    // Todas las respuestas deben ser 201
    respuestas.forEach((res) => {
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    // Todas deben compartir el MISMO ID de reserva
    const primerId = respuestas[0].body.id;
    respuestas.forEach((res) => {
      expect(res.body.id).toBe(primerId);
    });

    // Exactamente una en BD
    const totalReservas = await Reserva.count({ where: { aulaId: aula1.id } });
    expect(totalReservas).toBe(1);

    // Al menos 9 deben tener el header Idempotent-Replay: true (o las que no fueron la primera)
    const replays = respuestas.filter((r) => r.headers['idempotent-replay'] === 'true');
    expect(replays.length).toBeGreaterThanOrEqual(9);
  });

  it('3. Misma clave con cuerpo distinto -> responde 422', async () => {
    const key = crypto.randomUUID();
    const payload1 = {
      aulaId: aula1.id,
      fecha: fechaFutura(5),
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 15,
      motivo: 'Clase Consulta A'
    };

    const payload2 = {
      aulaId: aula1.id,
      fecha: fechaFutura(5),
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 30, // cuerpo diferente
      motivo: 'Clase Consulta B'
    };

    const res1 = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send(payload1);
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send(payload2);

    expect(res2.status).toBe(422);
    expect(res2.body.error).toMatch(/clave de idempotencia ya fue utilizada con un cuerpo diferente/i);
  });

  it('4. Usuarios distintos con la misma clave son independientes', async () => {
    const keyCompartida = crypto.randomUUID();

    // User 1 reserva aula1 08:00 a 10:00
    const res1 = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', keyCompartida)
      .send({
        aulaId: aula1.id,
        fecha: fechaFutura(6),
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 20,
        motivo: 'Clase Juan'
      });
    expect(res1.status).toBe(201);

    // User 2 usa la MISMA clave pero reserva aula2 (o distinto horario)
    const res2 = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token2}`)
      .set('Idempotency-Key', keyCompartida)
      .send({
        aulaId: aula2.id,
        fecha: fechaFutura(6),
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 15,
        motivo: 'Clase Maria'
      });
    expect(res2.status).toBe(201);
    expect(res2.body.id).not.toBe(res1.body.id);

    // Ambos tienen su clave registrada de forma independiente
    const clavesRegistradas = await IdempotencyKey.findAll({
      where: { clave: keyCompartida }
    });
    expect(clavesRegistradas.length).toBe(2);
  });

  it('5. Pedido fallido (4xx) NO consume la clave', async () => {
    const key = crypto.randomUUID();

    // Pedido con error 400: horaInicio >= horaFin
    const resErr = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send({
        aulaId: aula1.id,
        fecha: fechaFutura(7),
        horaInicio: '12:00',
        horaFin: '10:00', // Inválido
        cantidadPersonas: 20,
        motivo: 'Error de horario'
      });
    expect(resErr.status).toBe(400);

    // La clave NO debe haberse guardado en la base de datos
    const claveEnDb = await IdempotencyKey.findOne({
      where: { usuarioId: user1.id, clave: key }
    });
    expect(claveEnDb).toBeNull();

    // Corregimos el payload con la MISMA clave y ahora sí debe ser exitoso
    const resOk = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send({
        aulaId: aula1.id,
        fecha: fechaFutura(7),
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 20,
        motivo: 'Horario corregido'
      });
    expect(resOk.status).toBe(201);
    expect(resOk.body).toHaveProperty('id');
  });

  it('6. Sin encabezado Idempotency-Key el comportamiento habitual se preserva', async () => {
    const payload = {
      aulaId: aula1.id,
      fecha: fechaFutura(8),
      horaInicio: '16:00',
      horaFin: '18:00',
      cantidadPersonas: 20,
      motivo: 'Reserva sin clave'
    };

    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.headers['idempotent-replay']).toBeUndefined();
  });

  it('7. Encabezado con UUID inválido responde 400', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', 'clave-no-uuid-123')
      .send({
        aulaId: aula1.id,
        fecha: fechaFutura(9),
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 10,
        motivo: 'Test UUID inválido'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uuid válido/i);
  });

  it('8. Purgado de claves vencidas elimina registros expirados y conserva los activos', async () => {
    const keyVencida = crypto.randomUUID();
    const keyActiva = crypto.randomUUID();

    // Insertar una clave vencida (hace 2 días)
    await IdempotencyKey.create({
      usuarioId: user1.id,
      clave: keyVencida,
      cuerpoHash: 'hash-vencido',
      estadoRespuesta: 201,
      cuerpoRespuesta: { id: 999 },
      expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
    });

    // Insertar una clave activa (expira en 20 horas)
    await IdempotencyKey.create({
      usuarioId: user1.id,
      clave: keyActiva,
      cuerpoHash: 'hash-activo',
      estadoRespuesta: 201,
      cuerpoRespuesta: { id: 1000 },
      expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000)
    });

    const purgadas = await purgarClavesVencidas();
    expect(purgadas).toBeGreaterThanOrEqual(1);

    const checkVencida = await IdempotencyKey.findOne({ where: { clave: keyVencida } });
    expect(checkVencida).toBeNull();

    const checkActiva = await IdempotencyKey.findOne({ where: { clave: keyActiva } });
    expect(checkActiva).not.toBeNull();
  });

  it('9. Con clave, un choque con la reserva de OTRO usuario responde 400 sin demora', async () => {
    const payload = {
      aulaId: aula1.id,
      fecha: fechaFutura(7),
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 10,
      motivo: 'Clase de consulta'
    };

    const primera = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token2}`)
      .send(payload);
    expect(primera.status).toBe(201);

    const inicio = Date.now();
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send(payload);
    const duracion = Date.now() - inicio;

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ya está reservada en ese horario/i);
    expect(duracion).toBeLessThan(500);
  });

  it('10. Una clave vencida reutilizada se renueva y vuelve a proteger contra duplicados', async () => {
    const key = crypto.randomUUID();
    await IdempotencyKey.create({
      usuarioId: user1.id,
      clave: key,
      cuerpoHash: 'hash-vencido',
      estadoRespuesta: 201,
      cuerpoRespuesta: { id: 999 },
      expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
    });

    const payload = {
      aulaId: aula1.id,
      fecha: fechaFutura(8),
      horaInicio: '14:00',
      horaFin: '16:00',
      cantidadPersonas: 10,
      motivo: 'Clase de repaso'
    };

    const res1 = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send(payload);
    expect(res1.status).toBe(201);

    const registro = await IdempotencyKey.findOne({ where: { usuarioId: user1.id, clave: key } });
    expect(new Date(registro.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(registro.cuerpoRespuesta.id).toBe(res1.body.id);

    const res2 = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send(payload);
    expect(res2.status).toBe(201);
    expect(res2.headers['idempotent-replay']).toBe('true');
    expect(res2.body.id).toBe(res1.body.id);

    const total = await Reserva.count({ where: { usuarioId: user1.id } });
    expect(total).toBe(1);
  });
});
