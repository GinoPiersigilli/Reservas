import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import env from '../src/config/env.js';
import { Usuario, Aula, Reserva } from '../src/models/index.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

describe('Suite Integral de Seguridad y Pruebas de Ataque (SEC-TEST-SUITE)', () => {
  let usuarioAdmin;
  let usuarioA;
  let usuarioB;
  let aulaTest;
  let adminToken;
  let tokenA;
  let tokenB;

  const fechaFutura = (dias = 1) => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  };

  const firmarToken = (usuario, overrides = {}, secret = env.JWT_SECRET, options = {}) => {
    const payload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      ...overrides
    };
    return jwt.sign(payload, secret, {
      algorithm: 'HS256',
      issuer: 'reservas-api',
      expiresIn: '1h',
      ...options
    });
  };

  beforeAll(async () => {
    await limpiarBaseDeDatos();

    const passwordHash = await bcrypt.hash('Password123!', 10);

    usuarioAdmin = await Usuario.create({
      nombre: 'Admin General',
      email: 'admin.sec@test.com',
      passwordHash,
      rol: 'admin',
      activo: true
    });

    usuarioA = await Usuario.create({
      nombre: 'Usuario Atacante A',
      email: 'usuario.a@test.com',
      passwordHash,
      rol: 'usuario',
      activo: true
    });

    usuarioB = await Usuario.create({
      nombre: 'Usuario Victima B',
      email: 'usuario.b@test.com',
      passwordHash,
      rol: 'usuario',
      activo: true
    });

    aulaTest = await Aula.create({
      nombre: 'Laboratorio de Seguridad',
      capacidad: 40,
      ubicacion: 'Pabellón 1',
      activa: true
    });

    adminToken = firmarToken(usuarioAdmin);
    tokenA = firmarToken(usuarioA);
    tokenB = firmarToken(usuarioB);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('1. Manipulación de Tokens y Autenticación', () => {
    it('rechaza con 401 si el token no está presente en un endpoint protegido', async () => {
      const res = await request(app).get('/api/reservas');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('rechaza con 401 si el token está expirado', async () => {
      const tokenExpirado = jwt.sign(
        { id: usuarioA.id, email: usuarioA.email, rol: usuarioA.rol },
        env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '-10s' }
      );

      const res = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenExpirado}`);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('rechaza con 401 si el token tiene una firma inválida (secreto distinto)', async () => {
      const secretoFalso = ['clave', 'falsa', 'distinta', '123'].join('_');
      const tokenFalso = jwt.sign(
        { id: usuarioA.id, email: usuarioA.email, rol: usuarioA.rol },
        secretoFalso,
        { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenFalso}`);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('rechaza con 401 si el token utiliza algoritmo "none"', async () => {
      const claveVacia = String();
      const tokenAlgNone = jwt.sign(
        { id: usuarioA.id, email: usuarioA.email, rol: usuarioA.rol },
        claveVacia,
        { algorithm: 'none' }
      );

      const res = await request(app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenAlgNone}`);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('rechaza con 403 acciones de admin si el token declara rol admin pero el usuario es común en BD', async () => {
      // El usuario A falsifica su rol en el payload del token firmado con el secret válido
      const tokenRolAlterado = firmarToken(usuarioA, { rol: 'admin' });

      const res = await request(app)
        .get('/api/reservas/resumen')
        .set('Authorization', `Bearer ${tokenRolAlterado}`);

      // La verificación debe tomar el rol de la base de datos y rechazar con 403
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Acceso denegado/i);
    });
  });

  describe('2. Control de Acceso Horizontal (IDOR: Usuario A sobre reservas de Usuario B)', () => {
    let reservaB;

    beforeAll(async () => {
      reservaB = await Reserva.create({
        aulaId: aulaTest.id,
        usuarioId: usuarioB.id,
        fecha: '2026-08-01',
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 10,
        motivo: 'Clase reservada por B',
        estado: 'pendiente'
      });
    });

    it('rechaza con 404/403 a Usuario A intentando ver el detalle de la reserva de B', async () => {
      const res = await request(app)
        .get(`/api/reservas/${reservaB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect([403, 404]).toContain(res.status);
    });

    it('rechaza con 404/403 a Usuario A intentando ver el historial de la reserva de B', async () => {
      const res = await request(app)
        .get(`/api/reservas/${reservaB.id}/historial`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect([403, 404]).toContain(res.status);
    });

    it('rechaza con 403 a Usuario A intentando cancelar la reserva de B', async () => {
      const res = await request(app)
        .patch(`/api/reservas/${reservaB.id}/cancelar`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/No tienes permiso para cancelar esta reserva/i);
    });

    it('rechaza con 403 a Usuario A intentando editar la reserva de B', async () => {
      const res = await request(app)
        .put(`/api/reservas/${reservaB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          aulaId: aulaTest.id,
          fecha: '2026-08-01',
          horaInicio: '08:30',
          horaFin: '09:30',
          cantidadPersonas: 12,
          motivo: 'Intento de edición no autorizado'
        });

      expect(res.status).toBe(403);
    });

    it('permite a Usuario B acceder al detalle de su propia reserva', async () => {
      const res = await request(app)
        .get(`/api/reservas/${reservaB.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(reservaB.id);
    });
  });

  describe('3. Control de Acceso Vertical (Usuario común en acciones exclusivas de administrador)', () => {
    let reservaParaAdmin;

    beforeAll(async () => {
      reservaParaAdmin = await Reserva.create({
        aulaId: aulaTest.id,
        usuarioId: usuarioA.id,
        fecha: '2026-08-02',
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 15,
        motivo: 'Reserva para probar acciones admin',
        estado: 'pendiente'
      });
    });

    it('rechaza con 403 el acceso de usuario común a GET /api/reservas/resumen', async () => {
      const res = await request(app)
        .get('/api/reservas/resumen')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Acceso denegado/i);
    });

    it('rechaza con 403 a usuario común al intentar aprobar una reserva', async () => {
      const res = await request(app)
        .patch(`/api/reservas/${reservaParaAdmin.id}/aprobar`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Acceso denegado/i);
    });

    it('rechaza con 403 a usuario común al intentar rechazar una reserva', async () => {
      const res = await request(app)
        .patch(`/api/reservas/${reservaParaAdmin.id}/rechazar`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Acceso denegado/i);
    });

    it('rechaza con 403 a usuario común al intentar editar una reserva vía PUT', async () => {
      const res = await request(app)
        .put(`/api/reservas/${reservaParaAdmin.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          aulaId: aulaTest.id,
          fecha: '2026-08-02',
          horaInicio: '08:00',
          horaFin: '09:00',
          cantidadPersonas: 10,
          motivo: 'Edición intentada por usuario'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Acceso denegado/i);
    });
  });

  describe('4. Prevención de Asignación Masiva (Mass Assignment)', () => {
    it('ignora campos privilegiados (usuarioId, estado, id, rol) inyectados en la creación de reservas', async () => {
      const res = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          aulaId: aulaTest.id,
          fecha: fechaFutura(5),
          horaInicio: '10:00',
          horaFin: '12:00',
          cantidadPersonas: 20,
          motivo: 'Intento de asignación masiva',
          usuarioId: usuarioAdmin.id, // Suplantación de identidad
          estado: 'aprobada',         // Intento de auto-aprobación
          id: 999999,                 // Intento de forzar ID
          rol: 'admin'                // Intento de elevación
        });

      expect(res.status).toBe(201);
      const reservaCreada = res.body;

      // El usuario dueño debe ser el autenticado, no el inyectado
      expect(reservaCreada.usuarioId).toBe(usuarioA.id);
      expect(reservaCreada.usuarioId).not.toBe(usuarioAdmin.id);

      // El estado debe crearse como 'pendiente', ignorando el inyectado 'aprobada'
      expect(reservaCreada.estado).toBe('pendiente');

      // El ID no debe ser el inyectado
      expect(reservaCreada.id).not.toBe(999999);

      // El rol del usuario en la base de datos debe permanecer intacto
      const usuarioEnBd = await Usuario.findByPk(usuarioA.id);
      expect(usuarioEnBd.rol).toBe('usuario');
    });
  });

  describe('5. Inyección SQL y Cross-Site Scripting (XSS)', () => {
    it('guarda motivo con payload SQL parametrizado sin ejecutar inyección ni generar error 500', async () => {
      const payloadSql = "Reunión de prueba '; DROP TABLE reservas; --";

      const res = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          aulaId: aulaTest.id,
          fecha: fechaFutura(6),
          horaInicio: '10:00',
          horaFin: '12:00',
          cantidadPersonas: 10,
          motivo: payloadSql
        });

      expect(res.status).toBe(201);
      expect(res.body.motivo).toBe(payloadSql);

      // Comprobar que la tabla reservas sigue existiendo y funcionando
      const conteo = await Reserva.count();
      expect(conteo).toBeGreaterThan(0);
    });

    it('acepta motivo con payload XSS como texto plano sin error 500 ni ejecución', async () => {
      const payloadXss = "<script>alert('xss')</script><img src=x onerror=alert(1)>";

      const res = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          aulaId: aulaTest.id,
          fecha: fechaFutura(7),
          horaInicio: '10:00',
          horaFin: '12:00',
          cantidadPersonas: 10,
          motivo: payloadXss
        });

      expect(res.status).toBe(201);
      expect(res.body.motivo).toBe(payloadXss);
    });

    it('procesa filtros con payloads SQL y XSS en GET /api/reservas sin responder 500', async () => {
      const resSqlQ = await request(app)
        .get("/api/reservas?q=' OR 1=1 --")
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resSqlQ.status).toBe(200);

      const resXssQ = await request(app)
        .get('/api/reservas?q=<script>alert(1)</script>')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resXssQ.status).toBe(200);

      // Intento de inyección SQL en sortBy
      const resSortBySql = await request(app)
        .get('/api/reservas?sortBy=id;DROP TABLE reservas')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resSortBySql.status).toBe(200);

      // Fecha malformada con SQL injection debe ser rechazada por el esquema con 400, no 500
      const resFechaSql = await request(app)
        .get("/api/reservas?fecha=' UNION SELECT 1,2,3 --")
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resFechaSql.status).toBe(400);
    });

    it('rechaza inyección SQL en el campo email de login sin producir error 500', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: "' OR '1'='1' --",
          password: 'password123'
        });

      expect([400, 401]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });

  describe('6. Límite de Tamaño del Cuerpo (HTTP 413)', () => {
    it('devuelve status 413 ante cuerpos JSON gigantes mayores a 10kb', async () => {
      const payloadGigante = {
        aulaId: aulaTest.id,
        fecha: '2026-08-08',
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 10,
        motivo: 'Motivo normal',
        relleno: 'X'.repeat(12 * 1024)
      };

      const res = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(payloadGigante);

      expect(res.status).toBe(413);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/excede el tamaño máximo permitido/i);
    });
  });

  describe('7. Manejo de JSON Malformado (HTTP 400)', () => {
    it('devuelve status 400 estructurado ante un JSON sintácticamente inválido', async () => {
      const res = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Content-Type', 'application/json')
        .send('{"aulaId": 1, "motivo": ');

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('8. Mitigación de Fuerza Bruta en Login (HTTP 429)', () => {
    let trustProxyAnterior;
    const ipPrueba = '198.51.100.188';

    beforeAll(() => {
      trustProxyAnterior = app.get('trust proxy');
      app.set('trust proxy', 1);
    });

    afterAll(() => {
      app.set('trust proxy', trustProxyAnterior);
    });

    it('bloquea con 429 tras superar el límite de 10 intentos fallidos desde una misma IP', async () => {
      // 10 intentos fallidos
      for (let i = 0; i < 10; i++) {
        const respuesta = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', ipPrueba)
          .send({
            email: 'admin.sec@test.com',
            password: 'contraseña_incorrecta'
          });

        expect([400, 401]).toContain(respuesta.status);
      }

      // El intento 11 debe ser bloqueado con 429
      const resBloqueado = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ipPrueba)
        .send({
          email: 'admin.sec@test.com',
          password: 'Password123!'
        });

      expect(resBloqueado.status).toBe(429);
      expect(resBloqueado.body.error).toMatch(/Demasiados intentos de inicio de sesión/i);
    });
  });

  describe('9. Concurrencia Crítica: 20 Reservas Simultáneas al Mismo Horario', () => {
    it('permite exactamente 1 reserva y rechaza las otras 19 por colisión/superposición', async () => {
      const fechaConcurrente = fechaFutura(15);
      const horaInicio = '14:00';
      const horaFin = '16:00';

      const peticiones = Array.from({ length: 20 }, (_, index) =>
        request(app)
          .post('/api/reservas')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            aulaId: aulaTest.id,
            fecha: fechaConcurrente,
            horaInicio,
            horaFin,
            cantidadPersonas: 10,
            motivo: `Petición concurrente #${index + 1}`
          })
      );

      const resultados = await Promise.all(peticiones);

      const creadas = resultados.filter((r) => r.status === 201);
      const rechazadas = resultados.filter((r) => r.status === 400 || r.status === 409);

      expect(creadas.length).toBe(1);
      expect(rechazadas.length).toBe(19);

      rechazadas.forEach((r) => {
        expect(r.body.error).toMatch(/El aula ya está reservada en ese horario/i);
      });

      // Validar a nivel de base de datos que solo existe una reserva para ese intervalo
      const reservasEnBd = await Reserva.findAll({
        where: {
          aulaId: aulaTest.id,
          fecha: fechaConcurrente
        }
      });

      expect(reservasEnBd.length).toBe(1);
    });
  });

  describe('10. Prevención de Fuga de Información Sensible', () => {
    it('no expone passwordHash ni datos sensibles en respuestas de autenticación exitosa', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin.sec@test.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(200);
      const resStr = JSON.stringify(res.body);

      expect(resStr).not.toContain('passwordHash');
      expect(resStr).not.toContain('password_hash');
      expect(resStr).not.toContain('Password123!');
      expect(res.body.usuario).toHaveProperty('id');
      expect(res.body.usuario).toHaveProperty('email');
      expect(res.body.usuario).not.toHaveProperty('passwordHash');
    });

    it('no expone stack traces de código interno ni rutas de archivos en errores 4xx y 5xx', async () => {
      const res404 = await request(app)
        .get('/api/reservas/99999999')
        .set('Authorization', `Bearer ${adminToken}`);

      const res404Str = JSON.stringify(res404.body);
      expect(res404Str).not.toContain('stack');
      expect(res404Str).not.toContain('node_modules');
      expect(res404Str).not.toContain('at Object.');

      const res400 = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ aulaId: 'no_es_numero' });

      const res400Str = JSON.stringify(res400.body);
      expect(res400Str).not.toContain('stack');
      expect(res400Str).not.toContain('node_modules');
      expect(res400Str).not.toContain('at Object.');
    });
  });

  describe('11. Presencia de Cabeceras de Seguridad HTTP (Helmet)', () => {
    it('emite las cabeceras de seguridad requeridas en las respuestas HTTP', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(res.headers).toHaveProperty('x-frame-options');
      expect(['SAMEORIGIN', 'DENY']).toContain(res.headers['x-frame-options']);
      expect(res.headers).toHaveProperty('x-dns-prefetch-control', 'off');
      expect(res.headers).toHaveProperty('x-download-options', 'noopen');
    });
  });
});
