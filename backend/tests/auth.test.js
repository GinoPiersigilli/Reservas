import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Auth routes', () => {
  it('registers a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Test User', email: 'test@example.com', password: 'test123' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('nombre', 'Test User');
    expect(response.body).toHaveProperty('email', 'test@example.com');
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('rejects registration when email is already registered', async () => {
    await Usuario.create({
      nombre: 'Existing User',
      email: 'existing@example.com',
      passwordHash: await bcrypt.hash('test123', 10),
      rol: 'usuario',
      activo: true
    });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Existing User', email: 'existing@example.com', password: 'test123' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

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

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Credenciales inválidas');
  });
});
