import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env, { validarEnv } from '../src/config/env.js';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import { registrarUsuario } from '../src/services/auth.services.js';
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

  describe('SEC-AUTH-02: restricciones criptográficas de JWT local', () => {
    it('rejects token with algorithm "none" with 401', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ id: 1, rol: 'usuario', email: 'user@test.com', iss: 'reservas-api' })).toString('base64url');
      const tokenNone = `${header}.${payload}.`;

      const response = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenNone}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token inválido o expirado');
    });

    it('rejects token signed with HS512 with 401', async () => {
      const tokenHS512 = jwt.sign(
        { id: 1, rol: 'usuario', email: 'user@test.com' },
        env.JWT_SECRET,
        { algorithm: 'HS512', issuer: 'reservas-api', expiresIn: '2h' }
      );

      const response = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenHS512}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token inválido o expirado');
    });

    it('rejects token without issuer with 401', async () => {
      const tokenSinIssuer = jwt.sign(
        { id: 1, rol: 'usuario', email: 'user@test.com' },
        env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '2h' }
      );

      const response = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenSinIssuer}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token inválido o expirado');
    });
  });

  describe('SEC-AUTH-02: estado del usuario en cada petición (BD)', () => {
    it('blocks deactivated user with 401 without token expiring', async () => {
      const passwordHash = await bcrypt.hash('pass123', 10);
      const user = await Usuario.create({
        nombre: 'Usuario Activo',
        email: 'activo-test@example.com',
        passwordHash,
        rol: 'usuario',
        activo: true
      });

      const token = jwt.sign(
        { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
        env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '2h' }
      );

      const resAntes = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${token}`);
      expect(resAntes.status).toBe(200);

      // Desactivamos el usuario en la BD
      await user.update({ activo: false });

      const resDespues = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${token}`);
      expect(resDespues.status).toBe(401);
      expect(resDespues.body).toHaveProperty('error');
    });

    it('responds with 500 when Usuario.findByPk fails with database error, without falling through to Clerk 401', async () => {
      const passwordHash = await bcrypt.hash('pass123', 10);
      const user = await Usuario.create({
        nombre: 'Usuario DB Error',
        email: 'dberror@example.com',
        passwordHash,
        rol: 'usuario',
        activo: true
      });

      const token = jwt.sign(
        { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
        env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '2h' }
      );

      const spy = jest.spyOn(Usuario, 'findByPk').mockRejectedValueOnce(new Error('PostgreSQL connection dropped'));

      const response = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).not.toBe('Token inválido o expirado');

      spy.mockRestore();
    });

    it('falls through to Clerk verification when JWT is invalid and returns 401 if Clerk fails', async () => {
      const tokenInvalido = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTk5fQ.invalidSignature';

      const response = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenInvalido}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token inválido o expirado');
    });

    it('revokes admin access when downgraded to usuario without re-login', async () => {
      const passwordHash = await bcrypt.hash('pass123', 10);
      const admin = await Usuario.create({
        nombre: 'Admin Downgrade',
        email: 'admin-downgrade@example.com',
        passwordHash,
        rol: 'admin',
        activo: true
      });

      const tokenAdmin = jwt.sign(
        { id: admin.id, nombre: admin.nombre, email: admin.email, rol: admin.rol },
        env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '2h' }
      );

      const resAntes = await request(app)
        .get('/api/reservas/resumen')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(resAntes.status).toBe(200);

      // Degradar a usuario en la BD
      await admin.update({ rol: 'usuario' });

      const resDespues = await request(app)
        .get('/api/reservas/resumen')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(resDespues.status).toBe(403);
      expect(resDespues.body).toHaveProperty('error', 'Acceso denegado: se requiere rol admin');
    });
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
      emailAddresses: [{ emailAddress: 'ana.gomez@utnfrc.edu.ar', verification: { status: 'verified' } }],
      publicMetadata: { rol: 'admin' }
    });

    expect(typeof nuevo.id).toBe('number');
    expect(nuevo.clerkId).toBe('user_nuevo456');
    expect(nuevo.rol).toBe('admin');
    expect(nuevo.passwordHash).toBeNull();

    // Vincular usuario existente por email cuando aún no tenía clerkId
    const preexistente = await Usuario.create({
      nombre: 'Usuario Local Preexistente',
      email: 'preexistente@utnfrc.edu.ar',
      passwordHash: await bcrypt.hash('clave123', 10),
      clerkId: null,
      rol: 'usuario',
      activo: true
    });

    const vinculadoPorEmail = await sincronizarUsuarioClerk({
      id: 'user_clerk_vincular_email',
      firstName: 'Usuario',
      lastName: 'Preexistente',
      emailAddresses: [{ emailAddress: 'preexistente@utnfrc.edu.ar', verification: { status: 'verified' } }],
      publicMetadata: { rol: 'admin' }
    });

    expect(vinculadoPorEmail.id).toBe(preexistente.id);
    expect(vinculadoPorEmail.clerkId).toBe('user_clerk_vincular_email');
    expect(vinculadoPorEmail.rol).toBe('admin');
  });

  it('validates login required fields and rejects inactive user', async () => {
    const resSinCampos = await request(app)
      .post('/api/auth/login')
      .send({ email: 'solo@email.com' });
    expect(resSinCampos.status).toBe(400);
    expect(resSinCampos.body).toHaveProperty('error', 'Email y contraseña son obligatorios');

    const password = 'login123';
    await Usuario.create({
      nombre: 'Inactive User',
      email: 'inactivo@example.com',
      passwordHash: await bcrypt.hash(password, 10),
      rol: 'usuario',
      activo: false
    });

    const resInactivo = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactivo@example.com', password });
    expect(resInactivo.status).toBe(401);
  });

  describe('SEC-VAL-01: validación de esquema con Zod en login', () => {
    it('rejects login with invalid email format with 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'correo-invalido-sin-arroba', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'El formato del email es inválido');
    });

    it('rejects login with empty strings with 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: '   ', password: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email y contraseña son obligatorios');
    });
  });

  it('registers a new user with registrarUsuario, forces rol usuario ignoring input rol, and rejects duplicate email', async () => {
    const creado = await registrarUsuario({
      nombre: 'Nuevo Usuario',
      email: 'nuevo@utnfrc.edu.ar',
      password: 'password123',
      rol: 'admin'
    });

    expect(creado).toHaveProperty('id');
    expect(creado).toHaveProperty('email', 'nuevo@utnfrc.edu.ar');
    expect(creado).toHaveProperty('rol', 'usuario');
    expect(creado).not.toHaveProperty('passwordHash');

    await expect(
      registrarUsuario({
        nombre: 'Duplicado',
        email: 'nuevo@utnfrc.edu.ar',
        password: 'password123'
      })
    ).rejects.toThrow('El email ya está registrado');
  });

  it('responds 200 on GET /api/health without auth when database is connected and 503 on failure', async () => {
    const resOk = await request(app).get('/api/health');
    expect(resOk.status).toBe(200);
    expect(resOk.body).toMatchObject({
      status: 'ok',
      db: 'ok'
    });
    expect(resOk.body).toHaveProperty('timestamp');

    const authSpy = jest.spyOn(sequelize, 'authenticate').mockRejectedValueOnce(new Error('DB connection error'));
    try {
      const resFail = await request(app).get('/api/health');
      expect(resFail.status).toBe(503);
      expect(resFail.body).toMatchObject({
        status: 'error',
        db: 'disconnected'
      });
    } finally {
      authSpy.mockRestore();
    }
  });
});
