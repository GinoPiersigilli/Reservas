import request from 'supertest';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';

describe('SEC-CFG-02: Límite de tamaño del cuerpo de peticiones', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  it('devuelve status 413 y error en español al enviar un JSON que supera 10kb', async () => {
    // 12 KB de payload
    const payloadGrande = {
      email: 'usuario@example.com',
      password: 'password123',
      padding: 'x'.repeat(12 * 1024)
    };

    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(payloadGrande));

    expect(res.status).toBe(413);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/excede el tamaño máximo permitido/i);
  });

  it('devuelve status 413 y error en español al enviar un urlencoded que supera 10kb', async () => {
    const cuerpoGrandeUrlEncoded = 'dato=' + 'a'.repeat(12 * 1024);

    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(cuerpoGrandeUrlEncoded);

    expect(res.status).toBe(413);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/excede el tamaño máximo permitido/i);
  });

  it('procesa correctamente cuerpos JSON dentro del límite permitido (< 10kb)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usuario_invalido@example.com', password: 'password123' });

    // Criterio: no debe devolver 413 (puede ser 401 por credenciales inválidas)
    expect(res.status).not.toBe(413);
    expect(res.status).toBe(401);
  });
});
