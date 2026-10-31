import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../src/config/env.js';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import Aula from '../src/models/aula.model.js';
import Reserva from '../src/models/reserva.model.js';

let adminToken;
let usuarioToken;
let otroUsuarioToken;
let usuario;
let otroUsuario;
let aula;
let reservaPendiente;
let reservaOtroUsuario;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await Usuario.create({ nombre: 'Admin Test', email: 'admin@test.com', passwordHash, rol: 'admin', activo: true });
  usuario = await Usuario.create({ nombre: 'User Test A', email: 'user@test.com', passwordHash, rol: 'usuario', activo: true });
  otroUsuario = await Usuario.create({ nombre: 'User Test B', email: 'userb@test.com', passwordHash, rol: 'usuario', activo: true });

  adminToken = jwt.sign({ id: admin.id, nombre: admin.nombre, email: admin.email, rol: admin.rol }, env.JWT_SECRET, { expiresIn: '2h' });
  usuarioToken = jwt.sign({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }, env.JWT_SECRET, { expiresIn: '2h' });
  otroUsuarioToken = jwt.sign({ id: otroUsuario.id, nombre: otroUsuario.nombre, email: otroUsuario.email, rol: otroUsuario.rol }, env.JWT_SECRET, { expiresIn: '2h' });

  aula = await Aula.create({ nombre: 'Aula de Prueba', ubicacion: 'Piso 1', capacidad: 20, recursos: 'pizarra', activa: true });

  reservaPendiente = await Reserva.create({
    aulaId: aula.id,
    usuarioId: usuario.id,
    fecha: '2026-06-20',
    horaInicio: '10:00',
    horaFin: '12:00',
    cantidadPersonas: 10,
    motivo: 'Reserva de prueba usuario A',
    estado: 'pendiente'
  });

  reservaOtroUsuario = await Reserva.create({
    aulaId: aula.id,
    usuarioId: otroUsuario.id,
    fecha: '2026-06-20',
    horaInicio: '14:00',
    horaFin: '16:00',
    cantidadPersonas: 8,
    motivo: 'Reserva de prueba usuario B',
    estado: 'pendiente'
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Reservas API', () => {
  it('should reject access to protected route without JWT', async () => {
    const response = await request(app).get('/api/reservas');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Token no informado');
  });

  it('should reject admin-only action for normal user', async () => {
    const response = await request(app)
      .patch(`/api/reservas/${reservaPendiente.id}/aprobar`)
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error', 'Acceso denegado: se requiere rol admin');
  });

  it('should list reservas with and without filters', async () => {
    const responseAll = await request(app)
      .get('/api/reservas')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(responseAll.status).toBe(200);
    expect(responseAll.body).toHaveProperty('datos');
    expect(Array.isArray(responseAll.body.datos)).toBe(true);

    const responseFiltered = await request(app)
      .get(`/api/reservas?estado=pendiente&page=1&limit=5&sortBy=horaInicio&order=ASC`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(responseFiltered.status).toBe(200);
    expect(responseFiltered.body).toHaveProperty('datos');
    expect(responseFiltered.body.datos.every((r) => r.estado === 'pendiente')).toBe(true);
  });

  it('should cap limit=100000 to 100 in obtenerReservas', async () => {
    const response = await request(app)
      .get('/api/reservas?limit=100000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.porPagina).toBe(100);
  });

  it('should not fail when sortBy or order are invalid', async () => {
    const response = await request(app)
      .get('/api/reservas?sortBy=columnaInexistente&order=cualquierCosa')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.datos)).toBe(true);
  });

  it('should not show other users reservations to a normal user in the list', async () => {
    const response = await request(app)
      .get('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(response.status).toBe(200);
    expect(response.body.datos.length).toBeGreaterThan(0);
    expect(response.body.datos.every((r) => r.usuarioId === usuario.id)).toBe(true);
    expect(response.body.datos.some((r) => r.id === reservaOtroUsuario.id)).toBe(false);
  });

  it('should return 404 when user A requests reservation or history of user B', async () => {
    const detailResponse = await request(app)
      .get(`/api/reservas/${reservaOtroUsuario.id}`)
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(detailResponse.status).toBe(404);
    expect(detailResponse.body).toHaveProperty('error', 'La reserva no existe');

    const historyResponse = await request(app)
      .get(`/api/reservas/${reservaOtroUsuario.id}/historial`)
      .set('Authorization', `Bearer ${usuarioToken}`);

    expect(historyResponse.status).toBe(404);
    expect(historyResponse.body).toHaveProperty('error', 'La reserva no existe');
  });

  it('should return reservation detail for existing id', async () => {
    const response = await request(app)
      .get(`/api/reservas/${reservaPendiente.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', reservaPendiente.id);
    expect(response.body).toHaveProperty('aulaId', aula.id);
  });

  it('should return 404 for non-existent reservation detail', async () => {
    const response = await request(app)
      .get('/api/reservas/9999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'La reserva no existe');
  });

  it('should create a valid reservation', async () => {
    const response = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: '2026-06-21',
        horaInicio: '12:30',
        horaFin: '13:30',
        cantidadPersonas: 10,
        motivo: 'Reunión de equipo'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('estado', 'pendiente');
  });

  it('should reject reservation creation due capacity insufficient', async () => {
    const response = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: '2026-06-22',
        horaInicio: '09:00',
        horaFin: '10:00',
        cantidadPersonas: 50,
        motivo: 'Actividad grande'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'La cantidad de personas supera la capacidad del aula');
  });

  it('should reject reservation creation due overlapping schedule', async () => {
    const response = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        aulaId: aula.id,
        fecha: '2026-06-20',
        horaInicio: '11:00',
        horaFin: '13:00',
        cantidadPersonas: 5,
        motivo: 'Superposición de prueba'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'El aula ya está reservada en ese horario');
  });

  it('should reject invalid edit because of schedule conflict', async () => {
    await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: '2026-06-21',
      horaInicio: '14:00',
      horaFin: '16:00',
      cantidadPersonas: 5,
      motivo: 'Reserva conflicto',
      estado: 'pendiente'
    });

    const reservaParaEditar = await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: '2026-06-21',
      horaInicio: '16:00',
      horaFin: '18:00',
      cantidadPersonas: 5,
      motivo: 'Reserva para editar',
      estado: 'pendiente'
    });

    const response = await request(app)
      .put(`/api/reservas/${reservaParaEditar.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fecha: '2026-06-21',
        horaInicio: '15:30',
        horaFin: '17:00',
        cantidadPersonas: 5,
        motivo: 'Intento conflictivo'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'El aula ya está reservada en ese horario');
  });

  it('should reject approving a cancelled reservation', async () => {
    const reservaCancelada = await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuarioToken ? 999 : 999,
      fecha: '2026-06-23',
      horaInicio: '08:00',
      horaFin: '09:00',
      cantidadPersonas: 5,
      motivo: 'Reserva cancelada',
      estado: 'cancelada'
    });

    const response = await request(app)
      .patch(`/api/reservas/${reservaCancelada.id}/aprobar`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Solo se pueden aprobar reservas pendientes');
  });
});
