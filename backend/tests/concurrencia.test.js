import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import Aula from '../src/models/aula.model.js';
import Reserva from '../src/models/reserva.model.js';
import HistorialReserva from '../src/models/historial.model.js';
import env from '../src/config/env.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

function fechaFutura(dias = 12) {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return f.toISOString().split('T')[0];
}

describe('Fase 11 — Pruebas de Alta Concurrencia (100 pedidos simultáneos)', () => {
  let tokens = [];
  let aulaTest;

  // Jest timeout de 30 segundos para permitir que 100 transacciones completen
  jest.setTimeout(45000);

  beforeAll(async () => {
    await limpiarBaseDeDatos();

    // Crear un aula para las pruebas
    aulaTest = await Aula.create({
      nombre: 'Auditorio Concurrencia',
      ubicacion: 'Edificio Central',
      capacidad: 100,
      activa: true
    });

    // Crear 100 usuarios en bulk y generar sus tokens JWT
    const usuariosData = Array.from({ length: 100 }, (_, i) => ({
      nombre: `Usuario Concurrente ${i + 1}`,
      email: `concurrente_${i + 1}@utnfrc.edu.ar`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      rol: 'usuario',
      activo: true
    }));

    const usuariosCreados = await Usuario.bulkCreate(usuariosData, { returning: true });

    tokens = usuariosCreados.map((u) =>
      jwt.sign({ id: u.id, nombre: u.nombre, email: u.email, rol: 'usuario' }, env.JWT_SECRET, {
        expiresIn: '2h',
        algorithm: 'HS256',
        issuer: 'reservas-api'
      })
    );
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('1. 100 pedidos simultáneos de usuarios distintos para la MISMA aula y el MISMO horario -> exactamente 1 con 201, 99 con 400, cero 5xx', async () => {
    const fecha = fechaFutura(14);
    const horaInicio = '10:00';
    const horaFin = '12:00';

    // Disparamos 100 solicitudes simultáneas
    const promesas = tokens.map((token, i) =>
      request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          aulaId: aulaTest.id,
          fecha,
          horaInicio,
          horaFin,
          cantidadPersonas: 30,
          motivo: `Reserva simultanea de usuario ${i + 1}`
        })
    );

    const respuestas = await Promise.all(promesas);

    const aprobadas201 = respuestas.filter((r) => r.status === 201);
    const rechazadas400 = respuestas.filter((r) => r.status === 400);
    const errores5xx = respuestas.filter((r) => r.status >= 500);

    // 1. Exactamente una creada con 201
    expect(aprobadas201.length).toBe(1);

    // 2. Exactamente 99 rechazadas con 400 (horario ocupado)
    expect(rechazadas400.length).toBe(99);

    // 3. Cero respuestas 5xx
    expect(errores5xx.length).toBe(0);

    // 4. Cada 400 contiene el mensaje amigable de horario ocupado
    rechazadas400.forEach((r) => {
      expect(r.body.error).toMatch(/ya está reservada en ese horario/i);
    });

    // 5. Verificación en la base de datos: solo una reserva activa en esa franja
    const reservasEnDb = await Reserva.findAll({
      where: {
        aulaId: aulaTest.id,
        fecha
      }
    });
    expect(reservasEnDb.length).toBe(1);
    expect(reservasEnDb[0].id).toBe(aprobadas201[0].body.id);
    expect(reservasEnDb[0].estado).toBe('pendiente');

    // 6. Verificación de historial: exactamente una fila y NINGUNA huérfana
    const historiales = await HistorialReserva.findAll({
      where: {
        reservaId: reservasEnDb[0].id
      }
    });
    expect(historiales.length).toBe(1);
    expect(historiales[0].accion).toBe('creacion');

    // Chequeo de que no hay ningún historial con reservaId nulo o que no exista
    const todosHistoriales = await HistorialReserva.findAll();
    expect(todosHistoriales.length).toBe(1);
  });

  it('2. 100 pedidos repartidos en 10 franjas distintas -> exactamente 10 creadas', async () => {
    const fecha = fechaFutura(16);
    // 10 franjas horarias no solapadas de 1 hora entre las 08:00 y las 18:00
    const franjas = [
      { inicio: '08:00', fin: '09:00' },
      { inicio: '09:00', fin: '10:00' },
      { inicio: '10:00', fin: '11:00' },
      { inicio: '11:00', fin: '12:00' },
      { inicio: '12:00', fin: '13:00' },
      { inicio: '13:00', fin: '14:00' },
      { inicio: '14:00', fin: '15:00' },
      { inicio: '15:00', fin: '16:00' },
      { inicio: '16:00', fin: '17:00' },
      { inicio: '17:00', fin: '18:00' }
    ];

    // Repartimos los 100 usuarios: 10 usuarios compitiendo por cada una de las 10 franjas
    const promesas = tokens.map((token, i) => {
      const franjaIndex = i % 10;
      const franja = franjas[franjaIndex];

      return request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          aulaId: aulaTest.id,
          fecha,
          horaInicio: franja.inicio,
          horaFin: franja.fin,
          cantidadPersonas: 25,
          motivo: `Reserva franja ${franjaIndex + 1}`
        });
    });

    const respuestas = await Promise.all(promesas);

    const creadas201 = respuestas.filter((r) => r.status === 201);
    const rechazadas400 = respuestas.filter((r) => r.status === 400);
    const errores5xx = respuestas.filter((r) => r.status >= 500);

    // Exactamente 10 reservas creadas (1 por franja)
    expect(creadas201.length).toBe(10);
    // Exactamente 90 solicitudes rechazadas
    expect(rechazadas400.length).toBe(90);
    // Cero errores 5xx
    expect(errores5xx.length).toBe(0);

    // Verificación en BD: exactamente 10 reservas activas en esa fecha
    const reservasEnDb = await Reserva.findAll({
      where: {
        aulaId: aulaTest.id,
        fecha
      }
    });
    expect(reservasEnDb.length).toBe(10);
  });

  it('3. Error de espera por conexión del pool se convierte en 503 con Retry-After y nunca en 500', async () => {
    // Simulamos un error de timeout de adquisición de conexión del pool
    const mockError = new Error('ResourceRequest timed out');
    mockError.name = 'SequelizeConnectionAcquireTimeoutError';

    // Creamos una app de prueba mínima con el error middleware para verificar el mapeo
    const { manejadorErrores } = await import('../src/middleware/error.middleware.js');
    const express = (await import('express')).default;
    const testApp = express();

    testApp.get('/test-pool-timeout', (_req, _res, next) => {
      next(mockError);
    });
    testApp.use(manejadorErrores);

    const res = await request(testApp).get('/test-pool-timeout');

    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('2');
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/temporalmente sobrecargado/i);
    expect(res.body).not.toHaveProperty('stack');
  });
});
