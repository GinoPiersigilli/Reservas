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
  let usuariosTest = [];

  // Las 100 transacciones en conflicto se serializan en la restricción de
  // exclusión: en un runner de CI, con PostgreSQL en un contenedor, la prueba
  // puede tardar cerca de un minuto (en local, menos de un segundo).
  jest.setTimeout(150000);

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
    usuariosTest = usuariosCreados;

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

  it('1. 100 pedidos simultáneos de usuarios distintos para la MISMA aula y el MISMO horario -> exactamente 1 con 201, 99 con 409, cero 5xx', async () => {
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
    const rechazadas409 = respuestas.filter((r) => r.status === 409);
    const errores5xx = respuestas.filter((r) => r.status >= 500);

    // 1. Exactamente una creada con 201
    expect(aprobadas201.length).toBe(1);

    // 2. Exactamente 99 rechazadas con 409 (conflicto con el estado: el
    //    horario ya está ocupado)
    expect(rechazadas409.length).toBe(99);

    // 3. Cero respuestas 5xx
    expect(errores5xx.length).toBe(0);

    // 4. Cada 409 contiene el mensaje amigable de horario ocupado
    rechazadas409.forEach((r) => {
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
    const rechazadas409 = respuestas.filter((r) => r.status === 409);
    const errores5xx = respuestas.filter((r) => r.status >= 500);

    // Exactamente 10 reservas creadas (1 por franja)
    expect(creadas201.length).toBe(10);
    // Exactamente 90 solicitudes rechazadas
    expect(rechazadas409.length).toBe(90);
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

  describe('4. Conflictos transitorios de PostgreSQL (deadlock y serialización)', () => {
    // Un deadlock entre pedidos simultáneos por la misma franja salía como 500:
    // el pedido estaba bien y el conflicto era pasajero, pero quien lo recibía
    // no tenía forma de saber que repetirlo funcionaba. Lo destapó una corrida
    // de CI en la que PostgreSQL abortó dos transacciones y nueve de diez
    // pedidos devolvieron 5xx en vez de 409.

    const errorPg = (codigo, mensaje) => {
      const err = new Error(mensaje);
      err.name = 'SequelizeDatabaseError';
      err.parent = { code: codigo, message: mensaje };
      err.original = err.parent;
      return err;
    };

    const appConError = async (err) => {
      const { manejadorErrores } = await import('../src/middleware/error.middleware.js');
      const express = (await import('express')).default;
      const testApp = express();
      testApp.get('/falla', (_req, _res, next) => next(err));
      testApp.use(manejadorErrores);
      return testApp;
    };

    it.each([
      ['40P01', 'deadlock detected'],
      ['40001', 'could not serialize access due to concurrent update']
    ])('%s se convierte en 503 con Retry-After y nunca en 500', async (codigo, mensaje) => {
      const res = await request(await appConError(errorPg(codigo, mensaje))).get('/falla');

      expect(res.status).toBe(503);
      expect(res.headers['retry-after']).toBe('1');
      expect(res.body.error).toMatch(/reintente/i);
      expect(res.body).not.toHaveProperty('stack');
    });

    it('no filtra el mensaje de PostgreSQL al cliente', async () => {
      const res = await request(await appConError(errorPg('40P01', 'deadlock detected'))).get(
        '/falla'
      );

      expect(JSON.stringify(res.body)).not.toMatch(/deadlock/i);
    });

    it('crearNuevaReserva reintenta el deadlock y termina devolviendo el 409 que corresponde', async () => {
      jest.resetModules();
      const { crearNuevaReserva } = await import('../src/services/reservas.services.js');
      const sequelizeServicio = (await import('../src/config/database.js')).default;

      const datos = {
        aulaId: aulaTest.id,
        usuarioId: usuariosTest[0].id,
        fecha: fechaFutura(9),
        horaInicio: '09:00',
        horaFin: '11:00',
        cantidadPersonas: 10,
        motivo: 'Reintento tras deadlock'
      };

      // Primer intento: PostgreSQL aborta por deadlock. Segundo: el solapamiento
      // real, que es la respuesta que el cliente tiene que recibir.
      const original = sequelizeServicio.transaction.bind(sequelizeServicio);
      const espia = jest
        .spyOn(sequelizeServicio, 'transaction')
        .mockImplementationOnce(() => Promise.reject(errorPg('40P01', 'deadlock detected')))
        .mockImplementation(original);

      await expect(crearNuevaReserva(datos)).resolves.toHaveProperty('id');
      await expect(
        crearNuevaReserva({ ...datos, usuarioId: usuariosTest[1].id })
      ).rejects.toMatchObject({ status: 409 });

      // Dos llamadas para la primera reserva (el deadlock y el reintento) más
      // una para la segunda: el reintento ocurrió.
      expect(espia).toHaveBeenCalledTimes(3);
      espia.mockRestore();
    });

    it('deja de reintentar y propaga el error si el deadlock no cede', async () => {
      jest.resetModules();
      const { crearNuevaReserva } = await import('../src/services/reservas.services.js');
      const sequelizeServicio = (await import('../src/config/database.js')).default;

      const espia = jest
        .spyOn(sequelizeServicio, 'transaction')
        .mockImplementation(() => Promise.reject(errorPg('40P01', 'deadlock detected')));

      await expect(
        crearNuevaReserva({
          aulaId: aulaTest.id,
          usuarioId: usuariosTest[0].id,
          fecha: fechaFutura(10),
          horaInicio: '14:00',
          horaFin: '16:00',
          cantidadPersonas: 10,
          motivo: 'Deadlock permanente'
        })
      ).rejects.toMatchObject({ parent: { code: '40P01' } });

      // El intento original más tres reintentos: acotado, no infinito.
      expect(espia).toHaveBeenCalledTimes(4);
      espia.mockRestore();
    });
  });
});
