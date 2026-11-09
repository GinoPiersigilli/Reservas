import request from 'supertest';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';

describe('SEC-CFG-01: trust proxy & Rate Limiting por IP', () => {
  const ipA = '203.0.113.195';
  const ipB = '198.51.100.210';
  let previousTrustProxy;

  beforeAll(() => {
    previousTrustProxy = app.get('trust proxy');
    app.set('trust proxy', 1);
  });

  afterAll(async () => {
    app.set('trust proxy', previousTrustProxy);
    await sequelize.close();
  });

  it('mantiene contadores separados en el límite de login para dos IPs distintas en X-Forwarded-For', async () => {
    // 1. IP A realiza un intento
    const resA1 = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ipA)
      .send({ email: 'test_a@example.com', password: 'wrong' });

    const remainingA1 = Number(resA1.headers['ratelimit-remaining']);
    expect(remainingA1).toBe(9);

    // 2. IP A realiza un segundo intento
    const resA2 = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ipA)
      .send({ email: 'test_a@example.com', password: 'wrong' });

    const remainingA2 = Number(resA2.headers['ratelimit-remaining']);
    expect(remainingA2).toBe(8);

    // 3. IP B realiza su primer intento: su contador debe ser independiente (remaining = 9)
    const resB1 = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ipB)
      .send({ email: 'test_b@example.com', password: 'wrong' });

    const remainingB1 = Number(resB1.headers['ratelimit-remaining']);
    expect(remainingB1).toBe(9);
    expect(remainingB1).toBeGreaterThan(remainingA2);
  });
});
