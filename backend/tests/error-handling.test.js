import express from 'express';
import request from 'supertest';
import { manejadorErrores, sanitizarMensaje } from '../src/middleware/error.middleware.js';

describe('SEC-CFG-03: Manejo y registro seguro de errores en producción', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('sanitiza contraseñas, secretos y tokens JWT en los mensajes de error', () => {
    const raw =
      'Fallo de autenticación con password=SuperSecret123 y token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';
    const sanitizado = sanitizarMensaje(raw);

    expect(sanitizado).not.toContain('SuperSecret123');
    expect(sanitizado).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz');
    expect(sanitizado).toContain('[REDACTED]');
  });

  it('en producción responde 500 genérico con correlationId sin filtrar el mensaje interno', async () => {
    process.env.NODE_ENV = 'production';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const testApp = express();
    testApp.use(express.json());
    testApp.post('/test-error', (req, res, next) => {
      const err = new Error('Fallo crítico interno en base de datos sensibles');
      next(err);
    });
    testApp.use(manejadorErrores);

    const res = await request(testApp)
      .post('/test-error')
      .send({ email: 'usuario@example.com', password: 'mi_password_secreto' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Error interno del servidor');
    expect(res.body).toHaveProperty('correlationId');
    expect(res.body.error).not.toContain('base de datos sensibles');

    // Verificar lo registrado por consola
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logCall = consoleErrorSpy.mock.calls[0][0];

    // Loguea el id de correlación y el mensaje
    expect(logCall).toContain(`[Error ${res.body.correlationId}]`);
    expect(logCall).toContain('Fallo crítico interno en base de datos sensibles');

    // NO loguea el stack trace
    expect(logCall).not.toContain('Error: Fallo crítico interno');
    expect(logCall).not.toContain('at /test-error');

    // NUNCA loguea el cuerpo de la petición (que contiene contraseñas)
    expect(logCall).not.toContain('mi_password_secreto');
  });

  it('en producción sanitiza credenciales si el mensaje del error contiene secretos', async () => {
    process.env.NODE_ENV = 'production';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const testApp = express();
    testApp.get('/test-secret-error', (req, res, next) => {
      const err = new Error('Conexión rechazada con password=mi_clave_postgres');
      next(err);
    });
    testApp.use(manejadorErrores);

    const res = await request(testApp).get('/test-secret-error');

    expect(res.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logCall = consoleErrorSpy.mock.calls[0][0];

    expect(logCall).not.toContain('mi_clave_postgres');
    expect(logCall).toContain('password=[REDACTED]');
  });
});
