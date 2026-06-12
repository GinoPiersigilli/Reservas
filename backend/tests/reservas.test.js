import request from 'supertest';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import Aula from '../src/models/aula.model.js';
import Reserva from '../src/models/reserva.model.js';

let adminToken;
let userToken;
let aula;
let reservaPendiente;
let reservaCancelada;
let reservaParaEditar;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const admin = await Usuario.create({
    nombre: 'Administrador',
    email: 'admin@test.com',
    passwordHash: await import('bcrypt').then(({ default: bcrypt }) => bcrypt.hash('admin123', 10)),
    rol: 'admin',
    activo: true
  });

  const usuario = await Usuario.create({
    nombre: 'Usuario',
    email: 'user@test.com',
    passwordHash: await import('bcrypt').then(({ default: bcrypt }) => bcrypt.hash('user123', 10)),
    rol: 'usuario',
    activo: true
  });

  aula = await Aula.create({
    nombre: 'Aula de Prueba',
    ubicacion: 'Bloque I',
    capacidad: 30,
    recursos: 'proyector,pizarra',
    activa: true
  });

  reservaPendiente = await Reserva.create({
    aulaId: aula.id,
    usuarioId: usuario.id,
    fecha: '2026-06-18',
    horaInicio: '09:00',
    horaFin: '11:00',
    cantidadPersonas: 20,
    motivo: 'Clase de prueba',
    estado: 'pendiente'
  });

  reservaCancelada = await Reserva.create({
    aulaId: aula.id,
    usuarioId: usuario.id,
    fecha: '2026-06-18',
    horaInicio: '12:00',
    horaFin: '14:00',
    cantidadPersonas: 10,
    motivo: 'Reserva cancelada',
    estado: 'cancelada'
  });

  reservaParaEditar = await Reserva.create({
    aulaId: aula.id,
    usuarioId: usuario.id,
    fecha: '2026-06-18',
    horaInicio: '15:00',
    horaFin: '16:00',
    cantidadPersonas: 10,
    motivo: 'Reserva para editar',
    estado: 'pendiente'
  });

  const loginAdmin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'admin123' });
  adminToken = loginAdmin.body.token;

  const loginUser = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@test.com', password: 'user123' });
  userToken = loginUser.body.token;
});

afterAll(async () => {
  await sequelize.close();
});

test('Login correcto devuelve token y usuario', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'admin123' });

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('token');
  expect(response.body.usuario).toMatchObject({ email: 'admin@test.com', rol: 'admin' });
});

test('Login inválido devuelve 401 y mensaje de error', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'wrongpass' });

  expect(response.status).toBe(401);
  expect(response.body).toHaveProperty('error');
});

test('Listado de reservas sin filtros devuelve datos y total', async () => {
  const response = await request(app)
    .get('/api/reservas')
    .set('Authorization', `Bearer ${userToken}`);

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('total');
  expect(response.body).toHaveProperty('datos');
  expect(Array.isArray(response.body.datos)).toBe(true);
});

test('Listado de reservas con filtro de estado devuelve solo pendientes', async () => {
  const response = await request(app)
    .get('/api/reservas?estado=pendiente')
    .set('Authorization', `Bearer ${userToken}`);

  expect(response.status).toBe(200);
  expect(response.body.datos.every((reserva) => reserva.estado === 'pendiente')).toBe(true);
});

test('Detalle de reserva existente devuelve 200 y la reserva', async () => {
  const response = await request(app)
    .get(`/api/reservas/${reservaPendiente.id}`)
    .set('Authorization', `Bearer ${userToken}`);

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('id', reservaPendiente.id);
  expect(response.body).toHaveProperty('motivo', 'Clase de prueba');
});

test('Detalle de reserva inexistente devuelve 404 y error', async () => {
  const response = await request(app)
    .get('/api/reservas/9999')
    .set('Authorization', `Bearer ${userToken}`);

  expect(response.status).toBe(404);
  expect(response.body).toHaveProperty('error');
});

test('Creación válida de reserva devuelve 201 y reserva creada', async () => {
  const response = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      aulaId: aula.id,
      fecha: '2026-06-18',
      horaInicio: '11:00',
      horaFin: '12:00',
      cantidadPersonas: 10,
      motivo: 'Reserva válida'
    });

  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty('id');
  expect(response.body).toMatchObject({ motivo: 'Reserva válida', estado: 'pendiente' });
});

test('Creación inválida por capacidad insuficiente devuelve 400', async () => {
  const response = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      aulaId: aula.id,
      fecha: '2026-06-18',
      horaInicio: '17:00',
      horaFin: '18:00',
      cantidadPersonas: 100,
      motivo: 'Exceso de capacidad'
    });

  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error).toMatch(/capacidad/i);
});

test('Creación inválida por superposición horaria devuelve 400', async () => {
  const response = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      aulaId: aula.id,
      fecha: '2026-06-18',
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 10,
      motivo: 'Superposición'
    });

  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error).toMatch(/reservada|superposición/i);
});

test('Acceso sin JWT a ruta protegida devuelve 401', async () => {
  const response = await request(app)
    .get('/api/reservas');

  expect(response.status).toBe(401);
  expect(response.body).toHaveProperty('error');
});

test('Acceso con JWT de usuario a acción admin solo devuelve 403', async () => {
  const response = await request(app)
    .put(`/api/reservas/${reservaParaEditar.id}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ motivo: 'Intento de usuario' });

  expect(response.status).toBe(403);
  expect(response.body).toHaveProperty('error');
});

test('Edición inválida que genera conflicto de horario devuelve 400', async () => {
  const response = await request(app)
    .put(`/api/reservas/${reservaParaEditar.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ horaInicio: '10:00', horaFin: '12:00' });

  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error).toMatch(/reservada|horario/i);
});

test('Transición de estado no permitida devuelve 400 al aprobar reserva cancelada', async () => {
  const response = await request(app)
    .patch(`/api/reservas/${reservaCancelada.id}/aprobar`)
    .set('Authorization', `Bearer ${adminToken}`);

  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error).toMatch(/pendiente/i);
});
