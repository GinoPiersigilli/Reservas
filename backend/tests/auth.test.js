import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env, { validarEnv } from '../src/config/env.js';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import { sincronizarUsuarioClerk } from '../src/middleware/auth.middleware.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

beforeEach(async () => {
  await limpiarBaseDeDatos();
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

  it('provisions and links Clerk users locally preserving migrated clerkId id', async () => {
    const placeholder = await Usuario.create({
      nombre: 'Usuario Clerk [PLACEHOLDER user_migrado123]',
      email: 'user_migrado123@placeholder.clerk.local',
      passwordHash: null,
      clerkId: 'user_migrado123',
      rol: 'usuario',
      activo: true
    });

    const vinculado = await sincronizarUsuarioClerk({
      id: 'user_migrado123',
      firstName: 'Gino',
      lastName: 'Clerk',
      emailAddresses: [{ emailAddress: 'gino.clerk@utnfrc.edu.ar' }],
      publicMetadata: { rol: 'usuario' }
    });

    expect(vinculado.id).toBe(placeholder.id);
    expect(vinculado.email).toBe('gino.clerk@utnfrc.edu.ar');
    expect(vinculado.nombre).toBe('Gino Clerk');

    const nuevo = await sincronizarUsuarioClerk({
      id: 'user_nuevo456',
      firstName: 'Ana',
      lastName: 'Gómez',
      emailAddresses: [{ emailAddress: 'ana.gomez@utnfrc.edu.ar' }],
      publicMetadata: { rol: 'admin' }
    });

    expect(typeof nuevo.id).toBe('number');
    expect(nuevo.clerkId).toBe('user_nuevo456');
    expect(nuevo.rol).toBe('admin');
    expect(nuevo.passwordHash).toBeNull();
  });
});
