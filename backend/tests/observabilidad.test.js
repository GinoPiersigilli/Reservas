import express from 'express';
import request from 'supertest';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import { asignarRequestId } from '../src/middleware/observabilidad.middleware.js';
import { manejadorErrores } from '../src/middleware/error.middleware.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Captura las líneas JSON que el logger escribe en stdout y stderr. */
const capturarLogs = () => {
  const lineas = [];
  const recolectar = (chunk) => {
    const texto = chunk.toString().trim();
    for (const linea of texto.split('\n')) {
      try {
        lineas.push(JSON.parse(linea));
      } catch {
        /* líneas que no son del logger */
      }
    }
    return true;
  };

  const spyOut = jest.spyOn(process.stdout, 'write').mockImplementation(recolectar);
  const spyErr = jest.spyOn(process.stderr, 'write').mockImplementation(recolectar);
  return {
    lineas,
    restaurar: () => {
      spyOut.mockRestore();
      spyErr.mockRestore();
    }
  };
};

describe('Observabilidad', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('1. Identificador de petición', () => {
    it('genera un UUID y lo devuelve en la cabecera X-Request-Id', async () => {
      const res = await request(app).get('/api/health/live');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toMatch(UUID_REGEX);
    });

    it('respeta el identificador enviado por el cliente cuando es un UUID', async () => {
      const propio = '3f7c2b2e-5d4a-4c9b-8f1e-2a6d8b4c1e90';
      const res = await request(app).get('/api/health/live').set('X-Request-Id', propio);

      expect(res.headers['x-request-id']).toBe(propio);
    });

    it('descarta un identificador que no es UUID y genera uno propio', async () => {
      const res = await request(app)
        .get('/api/health/live')
        .set('X-Request-Id', 'no-es-un-uuid-123');

      expect(res.headers['x-request-id']).not.toContain('no-es-un-uuid-123');
      expect(res.headers['x-request-id']).toMatch(UUID_REGEX);
    });

    it('acepta también X-Correlation-Id', async () => {
      const propio = '11111111-2222-4333-8444-555555555555';
      const res = await request(app).get('/api/health/live').set('X-Correlation-Id', propio);

      expect(res.headers['x-request-id']).toBe(propio);
    });

    it('el correlationId de un error 500 coincide con la cabecera de la respuesta', async () => {
      process.env.LOG_LEVEL = 'silent';
      const testApp = express();
      testApp.use(asignarRequestId);
      testApp.get('/falla', (_req, _res, next) => next(new Error('falla interna')));
      testApp.use(manejadorErrores);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(testApp).get('/falla');
      consoleSpy.mockRestore();

      expect(res.status).toBe(500);
      expect(res.body.correlationId).toBe(res.headers['x-request-id']);
    });
  });

  describe('2. Registro estructurado', () => {
    const nivelOriginal = process.env.LOG_LEVEL;

    afterEach(() => {
      process.env.LOG_LEVEL = nivelOriginal;
      jest.resetModules();
    });

    it('escribe una línea JSON por petición con ruta, estado, duración e id', async () => {
      jest.resetModules();
      process.env.LOG_LEVEL = 'info';

      const { asignarRequestId: asignar, registrarPeticiones: registrar } = await import(
        '../src/middleware/observabilidad.middleware.js'
      );

      const testApp = express();
      testApp.use(asignar);
      testApp.use(registrar);
      testApp.get('/recurso/:id', (_req, res) => res.status(200).json({ ok: true }));

      const captura = capturarLogs();
      const res = await request(testApp).get('/recurso/7');
      await new Promise((r) => setImmediate(r));
      captura.restaurar();

      const linea = captura.lineas.find((l) => l.mensaje === 'peticion');
      expect(linea).toBeDefined();
      expect(linea).toMatchObject({
        nivel: 'info',
        metodo: 'GET',
        ruta: '/recurso/:id',
        estado: 200
      });
      expect(linea.requestId).toBe(res.headers['x-request-id']);
      expect(typeof linea.duracionMs).toBe('number');
      // La ruta declarada, no la real: no debe filtrar el identificador.
      expect(linea.ruta).not.toContain('7');
    });

    it('registra los errores del servidor en nivel error y los rechazos en nivel warn', async () => {
      jest.resetModules();
      process.env.LOG_LEVEL = 'info';

      const { asignarRequestId: asignar } = await import(
        '../src/middleware/observabilidad.middleware.js'
      );
      const { manejadorErrores: manejador } = await import('../src/middleware/error.middleware.js');

      const testApp = express();
      testApp.use(asignar);
      testApp.get('/interno', (_req, _res, next) => next(new Error('se rompió algo')));
      testApp.get('/invalido', (_req, _res, next) => {
        const err = new Error('falta un campo');
        err.status = 400;
        next(err);
      });
      testApp.use(manejador);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const captura = capturarLogs();
      await request(testApp).get('/interno');
      await request(testApp).get('/invalido');
      captura.restaurar();
      consoleSpy.mockRestore();

      const error = captura.lineas.find((l) => l.mensaje === 'error no controlado');
      const aviso = captura.lineas.find((l) => l.mensaje === 'peticion rechazada');

      expect(error).toMatchObject({ nivel: 'error', status: 500 });
      expect(aviso).toMatchObject({ nivel: 'warn', status: 400 });
      // Un 4xx no deja traza: no es una falla del servidor.
      expect(aviso.traza).toBeUndefined();
    });

    it('oculta secretos y claves sensibles en lo que registra', async () => {
      jest.resetModules();
      process.env.LOG_LEVEL = 'info';
      const { logger } = await import('../src/utils/logger.js');

      const captura = capturarLogs();
      logger.info('intento con password=SuperSecreto123', {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghijk',
        password: 'otra-clave',
        anidado: { token: 'valor-secreto', visible: 'dato-publico' }
      });
      captura.restaurar();

      const texto = JSON.stringify(captura.lineas);
      expect(texto).not.toContain('SuperSecreto123');
      expect(texto).not.toContain('otra-clave');
      expect(texto).not.toContain('valor-secreto');
      expect(texto).toContain('[REDACTED]');
      expect(texto).toContain('dato-publico');
    });

    it('con LOG_LEVEL=silent no escribe nada', async () => {
      jest.resetModules();
      process.env.LOG_LEVEL = 'silent';
      const { logger } = await import('../src/utils/logger.js');

      const captura = capturarLogs();
      logger.info('no debería aparecer');
      logger.error('tampoco esta');
      captura.restaurar();

      expect(captura.lineas).toHaveLength(0);
    });
  });

  describe('3. Consultas lentas', () => {
    const entornoOriginal = { ...process.env };

    afterEach(() => {
      process.env.LOG_LEVEL = entornoOriginal.LOG_LEVEL;
      process.env.SLOW_QUERY_MS = entornoOriginal.SLOW_QUERY_MS;
      jest.resetModules();
    });

    it('registra una consulta que supera el umbral y no las rápidas', async () => {
      jest.resetModules();
      process.env.LOG_LEVEL = 'warn';
      process.env.SLOW_QUERY_MS = '100';

      const { default: conexion } = await import('../src/config/database.js');
      const captura = capturarLogs();
      try {
        await conexion.query('SELECT pg_sleep(0.25)');
        await conexion.query('SELECT 1');
      } finally {
        captura.restaurar();
        await conexion.close();
      }

      const lentas = captura.lineas.filter((l) => l.mensaje === 'consulta lenta');
      expect(lentas).toHaveLength(1);
      expect(lentas[0]).toMatchObject({ nivel: 'warn', umbralMs: 100 });
      expect(lentas[0].sql).toContain('pg_sleep');
      expect(lentas[0].duracionMs).toBeGreaterThanOrEqual(100);
    }, 30000);
  });

  describe('4. Sondas de estado', () => {
    it('liveness responde 200 sin consultar la base de datos', async () => {
      const spy = jest.spyOn(sequelize, 'authenticate');

      const res = await request(app).get('/api/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptimeSegundos).toBe('number');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('readiness responde 200 cuando la base responde', async () => {
      const res = await request(app).get('/api/health/ready');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
    });

    it('readiness responde 503 cuando la base falla', async () => {
      const spy = jest
        .spyOn(sequelize, 'authenticate')
        .mockRejectedValueOnce(new Error('connection refused'));

      const res = await request(app).get('/api/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
      spy.mockRestore();
    });

    it('readiness responde 503 si la base no contesta a tiempo', async () => {
      const spy = jest.spyOn(sequelize, 'authenticate').mockImplementationOnce(
        () =>
          new Promise((r) => {
            // unref: el temporizador no debe mantener vivo el proceso de pruebas.
            setTimeout(r, 5000).unref?.();
          })
      );

      const res = await request(app).get('/api/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.db).toBe('timeout');
      spy.mockRestore();
    }, 10000);

    it('las sondas no consumen el límite general de peticiones', async () => {
      const respuestas = await Promise.all(
        Array.from({ length: 40 }, () => request(app).get('/api/health/live'))
      );

      expect(respuestas.every((r) => r.status === 200)).toBe(true);
    });
  });
});
