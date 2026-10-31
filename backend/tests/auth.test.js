import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env, { validarEnv } from '../src/config/env.js';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Auth routes, token verification & env validation', () => {
  it('logs in an existing user', async () => {
    const password = 'login123';

    await Usuario.create({
      nombre: 'Login User',
      email: 'login@example.com',
      passwordHash: await bcrypt.hash(password, 10),
      rol: 'usuario',
      activo: true
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.usuario).toHaveProperty('email', 'login@example.com');
  });

  it('rejects login with invalid credentials', async () => {
    const password = 'login123';

    await Usuario.create({
      nombre: 'Login User 2',
      email: 'login2@example.com',
      passwordHash: await bcrypt.hash(password, 10),
      rol: 'usuario',
      activo: true
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login2@example.com', password: 'wrongpassword' });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Credenciales inválidas');
  });

  it('rejects JWT/Clerk token with invalid signature with 401', async () => {
    const tokenFirmaInvalida = jwt.sign(
      { sub: 'user_fake_clerk_admin', id: 1, rol: 'admin', email: 'admin@utnfrc.edu.ar' },
      'clave_secreta_falsa_invalida',
      { expiresIn: '2h' }
    );

    const response = await request(app)
      .get('/api/reservas')
      .set('Authorization', `Bearer ${tokenFirmaInvalida}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Token inválido o expirado');
  });

  it('aborts startup when JWT_SECRET is missing in development or production', async () => {
    expect(() => validarEnv({ NODE_ENV: 'development', JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
    expect(() => validarEnv({ NODE_ENV: 'production', CLERK_SECRET_KEY: 'sk_test_123' })).toThrow(/JWT_SECRET/);
    expect(() => validarEnv({ NODE_ENV: 'production', JWT_SECRET: 'secreto_valido' })).toThrow(/CLERK_SECRET_KEY/);

    const originalJwtSecret = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      jest.resetModules();
      await expect(import('../src/config/env.js')).rejects.toThrow(/JWT_SECRET/);
    } finally {
      process.env.JWT_SECRET = originalJwtSecret || env.JWT_SECRET;
    }
  });
});
