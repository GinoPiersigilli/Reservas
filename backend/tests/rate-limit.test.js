import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import env from '../src/config/env.js';
import { setTestRateLimits, resetTestRateLimits } from '../src/middleware/rateLimit.middleware.js';

describe('SEC-RATELIMIT: Protección contra abusos y Missing Rate Limiting', () => {
  let previousTrustProxy;

  beforeAll(() => {
    previousTrustProxy = app.get('trust proxy');
    app.set('trust proxy', 1);
  });

  afterAll(async () => {
    app.set('trust proxy', previousTrustProxy);
    resetTestRateLimits();
    await sequelize.close();
  });

  afterEach(() => {
    resetTestRateLimits();
  });

  describe('1. Límite General sobre /api y exención de /api/health', () => {
    it('bloquea con 429 y Retry-After al superar el límite general inyectado', async () => {
      // Inyectamos límite bajo: 2 pedidos por ventana
      setTestRateLimits({ general: 2 });

      const testIp = '198.51.100.60';

      // Pedido 1 -> 200 o respuesta no 429
      const res1 = await request(app)
        .get('/api/health') // health no debe descontar del limitador general
        .set('X-Forwarded-For', testIp);
      expect(res1.status).toBe(200);

      // Pedidos a /api/aulas (cubierto por limiteGeneral)
      const res2 = await request(app).get('/api/aulas').set('X-Forwarded-For', testIp);
      expect(res2.status).not.toBe(429);

      const res3 = await request(app).get('/api/aulas').set('X-Forwarded-For', testIp);
      expect(res3.status).not.toBe(429);

      // Pedido 3 a /api/aulas -> excede el límite de 2 -> 429
      const res4 = await request(app).get('/api/aulas').set('X-Forwarded-For', testIp);

      expect(res4.status).toBe(429);
      expect(res4.headers['retry-after']).toBeDefined();
      expect(Number(res4.headers['retry-after'])).toBeGreaterThan(0);
      expect(res4.body).toHaveProperty('error');
      expect(res4.body.error).toMatch(/demasiadas solicitudes/i);

      // Verificamos que /api/health NUNCA recibe 429 incluso con la IP bloqueada
      const resHealth = await request(app).get('/api/health').set('X-Forwarded-For', testIp);

      expect(resHealth.status).toBe(200);
      expect(resHealth.body.status).toBe('ok');
    });
  });

  describe('2. Límite de Escrituras en rutas POST, PUT, PATCH antes de auth', () => {
    it('bloquea con 429 y Retry-After en POST /api/aulas antes de verificarToken', async () => {
      setTestRateLimits({ escrituras: 2 });

      const testIp = '198.51.100.70';

      // 1er POST sin token
      const res1 = await request(app)
        .post('/api/aulas')
        .set('X-Forwarded-For', testIp)
        .send({ nombre: 'Aula Prueba' });
      // Se evalúa después del limitador: da 401 por falta de token
      expect(res1.status).toBe(401);

      // 2do POST sin token
      const res2 = await request(app)
        .post('/api/aulas')
        .set('X-Forwarded-For', testIp)
        .send({ nombre: 'Aula Prueba' });
      expect(res2.status).toBe(401);

      // 3er POST -> limitador de escrituras bloquea antes de autenticación con 429
      const res3 = await request(app)
        .post('/api/aulas')
        .set('X-Forwarded-For', testIp)
        .send({ nombre: 'Aula Prueba' });

      expect(res3.status).toBe(429);
      expect(res3.headers['retry-after']).toBeDefined();
      expect(res3.body).toHaveProperty('error');
      expect(res3.body.error).toMatch(/demasiadas solicitudes/i);
    });

    it('bloquea con 429 en POST /api/reservas al superar el límite de escrituras', async () => {
      setTestRateLimits({ escrituras: 1 });

      const testIp = '198.51.100.80';

      const res1 = await request(app).post('/api/reservas').set('X-Forwarded-For', testIp).send({});
      expect(res1.status).toBe(401);

      const res2 = await request(app).post('/api/reservas').set('X-Forwarded-For', testIp).send({});
      expect(res2.status).toBe(429);
      expect(res2.headers['retry-after']).toBeDefined();
    });

    it('mantiene contadores independientes por IP detrás de proxy reverso', async () => {
      setTestRateLimits({ escrituras: 1 });

      const ip1 = '198.51.100.91';
      const ip2 = '198.51.100.92';

      // IP 1 consume su único intento
      await request(app).patch('/api/aulas/1/desactivar').set('X-Forwarded-For', ip1).send({});

      // IP 1 bloqueada
      const resIp1Bloqueada = await request(app)
        .patch('/api/aulas/1/desactivar')
        .set('X-Forwarded-For', ip1)
        .send({});
      expect(resIp1Bloqueada.status).toBe(429);

      // IP 2 aún tiene cupo
      const resIp2 = await request(app)
        .patch('/api/aulas/1/desactivar')
        .set('X-Forwarded-For', ip2)
        .send({});
      expect(resIp2.status).toBe(401); // Llega a auth, no 429
    });
  });

  describe('3. Límite de Escrituras por Usuario Autenticado (no por IP)', () => {
    let tokenUsuarioA;
    let tokenUsuarioB;

    beforeAll(async () => {
      const uA = await Usuario.create({
        nombre: 'Docente RateLimit A',
        email: 'user_rate_a@utnfrc.edu.ar',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
        rol: 'usuario',
        activo: true
      });
      const uB = await Usuario.create({
        nombre: 'Docente RateLimit B',
        email: 'user_rate_b@utnfrc.edu.ar',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
        rol: 'usuario',
        activo: true
      });

      tokenUsuarioA = jwt.sign(
        { id: uA.id, nombre: uA.nombre, email: uA.email, rol: uA.rol },
        env.JWT_SECRET,
        { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
      );

      tokenUsuarioB = jwt.sign(
        { id: uB.id, nombre: uB.nombre, email: uB.email, rol: uB.rol },
        env.JWT_SECRET,
        { expiresIn: '2h', algorithm: 'HS256', issuer: 'reservas-api' }
      );
    });

    it('bloquea al usuario con 429 y Retry-After tras exceder su cuota de modificaciones, sin afectar a otro usuario desde la misma IP', async () => {
      setTestRateLimits({ general: 1000, escrituras: 1000, usuario: 2 });
      const ipCompartida = '198.51.100.111';

      // Pedido 1 de Usuario A
      const res1 = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenUsuarioA}`)
        .set('X-Forwarded-For', ipCompartida)
        .send({});
      expect(res1.status).toBe(400); // Falla por validación de body, pero pasó auth y rate limit

      // Pedido 2 de Usuario A
      const res2 = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenUsuarioA}`)
        .set('X-Forwarded-For', ipCompartida)
        .send({});
      expect(res2.status).toBe(400);

      // Pedido 3 de Usuario A -> Excede el límite de 2 pedidos de usuario -> 429
      const res3 = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenUsuarioA}`)
        .set('X-Forwarded-For', ipCompartida)
        .send({});
      expect(res3.status).toBe(429);
      expect(res3.headers['retry-after']).toBeDefined();
      expect(res3.body).toHaveProperty('error');
      expect(res3.body.error).toMatch(/usuario/i);

      // Usuario B desde la MISMA IP no está bloqueado
      const resB = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenUsuarioB}`)
        .set('X-Forwarded-For', ipCompartida)
        .send({});
      expect(resB.status).toBe(400); // Llega a validación, no 429
    });
  });
});
