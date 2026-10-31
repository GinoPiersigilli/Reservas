import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Auth routes & token verification', () => {
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
});
