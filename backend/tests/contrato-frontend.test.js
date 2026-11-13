import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import Aula from '../src/models/aula.model.js';
import Reserva from '../src/models/reserva.model.js';
import env from '../src/config/env.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

function fechaFutura(dias = 5) {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return f.toISOString().split('T')[0];
}

describe('Contrato Frontend-Backend: Replicación exacta de peticiones del cliente', () => {
  let adminUser;
  let usuarioUser;
  let adminToken;
  let usuarioToken;
  let aulaActiva;

  beforeEach(async () => {
    await limpiarBaseDeDatos();

    adminUser = await Usuario.create({
      nombre: 'Administrador UTN',
      email: 'admin@utnfrc.edu.ar',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      rol: 'admin',
      activo: true
    });

    usuarioUser = await Usuario.create({
      nombre: 'Docente Juan Perez',
      email: 'docente@utnfrc.edu.ar',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      rol: 'usuario',
      activo: true
    });

    adminToken = jwt.sign(
      { id: adminUser.id, nombre: adminUser.nombre, email: adminUser.email, rol: 'admin' },
      env.JWT_SECRET,
      { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '2h' }
    );

    usuarioToken = jwt.sign(
      { id: usuarioUser.id, nombre: usuarioUser.nombre, email: usuarioUser.email, rol: 'usuario' },
      env.JWT_SECRET,
      { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '2h' }
    );

    aulaActiva = await Aula.create({
      nombre: 'Aula 101 Magna',
      capacidad: 60,
      tipo: 'Teórica',
      ubicacion: 'Pabellón Central - Piso 1',
      activa: true
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('1. Listado de Reservas (Reservas.jsx)', () => {
    it('responde 200 para admin y usuario con todos los filtros vacíos como envía la pantalla', async () => {
      const qsVacios = 'fecha=&estado=&aulaId=&q=&page=1&limit=10&sortBy=createdAt&order=DESC';

      const resAdmin = await request(app)
        .get(`/api/reservas?${qsVacios}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body).toHaveProperty('datos');
      expect(resAdmin.body).toHaveProperty('total');
      expect(resAdmin.body.pagina).toBe(1);

      const resUsuario = await request(app)
        .get(`/api/reservas?${qsVacios}`)
        .set('Authorization', `Bearer ${usuarioToken}`);
      expect(resUsuario.status).toBe(200);
      expect(resUsuario.body).toHaveProperty('datos');
      expect(resUsuario.body).toHaveProperty('total');
      expect(resUsuario.body.pagina).toBe(1);
    });

    it('responde 200 con cada filtro individual con valor', async () => {
      const f = fechaFutura(2);
      // Filtro fecha
      const resFecha = await request(app)
        .get(`/api/reservas?fecha=${f}&page=1&limit=10&sortBy=createdAt&order=DESC`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resFecha.status).toBe(200);

      // Filtro estado
      const resEstado = await request(app)
        .get('/api/reservas?estado=pendiente&page=1&limit=10&sortBy=createdAt&order=DESC')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resEstado.status).toBe(200);

      // Filtro aulaId
      const resAula = await request(app)
        .get(`/api/reservas?aulaId=${aulaActiva.id}&page=1&limit=10&sortBy=createdAt&order=DESC`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAula.status).toBe(200);

      // Filtro q
      const resQ = await request(app)
        .get('/api/reservas?q=consulta&page=1&limit=10&sortBy=createdAt&order=DESC')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resQ.status).toBe(200);
    });

    it('responde 200 en página 2', async () => {
      const resPag2 = await request(app)
        .get('/api/reservas?page=2&limit=10&sortBy=createdAt&order=DESC')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resPag2.status).toBe(200);
      expect(resPag2.body.pagina).toBe(2);
    });

    it('responde 200 con orden personalizado', async () => {
      const resOrden = await request(app)
        .get('/api/reservas?page=1&limit=10&sortBy=fecha&order=ASC')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resOrden.status).toBe(200);
    });
  });

  describe('2. Panel de Administración / Resumen (Resumen.jsx)', () => {
    it('responde 200 en GET /api/reservas/resumen para admin', async () => {
      const res = await request(app)
        .get('/api/reservas/resumen')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('porEstado');
      expect(res.body).toHaveProperty('porAula');
      expect(res.body).toHaveProperty('proximasHoy');
      expect(res.body).toHaveProperty('distribucionEstados');
      expect(res.body).toHaveProperty('tasaOcupacionAulas');
      expect(res.body).toHaveProperty('aulasMayorDemanda');
    });

    it('responde 200 en la consulta de pendientes que ejecuta Resumen.jsx', async () => {
      const res = await request(app)
        .get('/api/reservas?estado=pendiente&limit=50&sortBy=fecha&order=ASC')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('datos');
    });
  });

  describe('3. Creación y Edición con valores de texto (FormularioReserva.jsx)', () => {
    it('crea reserva con valores en formato string tal como los envía el formulario HTML', async () => {
      const payloadString = {
        aulaId: String(aulaActiva.id),
        fecha: fechaFutura(4),
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: '35',
        motivo: 'Clase de Sistemas Operativos'
      };

      const res = await request(app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${usuarioToken}`)
        .send(payloadString);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.aulaId).toBe(aulaActiva.id);
      expect(res.body.cantidadPersonas).toBe(35);
      expect(res.body.motivo).toBe('Clase de Sistemas Operativos');
    });

    it('edita reserva con valores en formato string tal como los envía el formulario HTML (admin)', async () => {
      const reserva = await Reserva.create({
        aulaId: aulaActiva.id,
        usuarioId: usuarioUser.id,
        fecha: fechaFutura(7),
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 20,
        motivo: 'Reunión de Cátedra',
        estado: 'pendiente'
      });

      const payloadEdicion = {
        aulaId: String(aulaActiva.id),
        fecha: fechaFutura(8),
        horaInicio: '14:00',
        horaFin: '16:00',
        cantidadPersonas: '25',
        motivo: 'Reunión reprogramada'
      };

      const res = await request(app)
        .put(`/api/reservas/${reserva.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payloadEdicion);

      expect(res.status).toBe(200);
      expect(res.body.motivo).toBe('Reunión reprogramada');
      expect(res.body.cantidadPersonas).toBe(25);
    });
  });

  describe('4. Detalle e Historial (DetalleReserva.jsx)', () => {
    let reservaTest;

    beforeEach(async () => {
      reservaTest = await Reserva.create({
        aulaId: aulaActiva.id,
        usuarioId: usuarioUser.id,
        fecha: fechaFutura(10),
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: 30,
        motivo: 'Examen Final',
        estado: 'pendiente'
      });
    });

    it('obtiene detalle de reserva para admin y para el usuario dueño', async () => {
      const resAdmin = await request(app)
        .get(`/api/reservas/${reservaTest.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.id).toBe(reservaTest.id);

      const resUsuario = await request(app)
        .get(`/api/reservas/${reservaTest.id}`)
        .set('Authorization', `Bearer ${usuarioToken}`);
      expect(resUsuario.status).toBe(200);
      expect(resUsuario.body.id).toBe(reservaTest.id);
    });

    it('obtiene historial de reserva para admin y para el usuario dueño', async () => {
      const resAdmin = await request(app)
        .get(`/api/reservas/${reservaTest.id}/historial`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(Array.isArray(resAdmin.body)).toBe(true);

      const resUsuario = await request(app)
        .get(`/api/reservas/${reservaTest.id}/historial`)
        .set('Authorization', `Bearer ${usuarioToken}`);
      expect(resUsuario.status).toBe(200);
      expect(Array.isArray(resUsuario.body)).toBe(true);
    });
  });

  describe('5. Acciones de Estado: Aprobar, Rechazar, Cancelar', () => {
    it('aprobar reserva responde 200 para admin', async () => {
      const r = await Reserva.create({
        aulaId: aulaActiva.id,
        usuarioId: usuarioUser.id,
        fecha: fechaFutura(12),
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 15,
        motivo: 'Taller',
        estado: 'pendiente'
      });

      const res = await request(app)
        .patch(`/api/reservas/${r.id}/aprobar`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('aprobada');
    });

    it('rechazar reserva responde 200 para admin', async () => {
      const r = await Reserva.create({
        aulaId: aulaActiva.id,
        usuarioId: usuarioUser.id,
        fecha: fechaFutura(13),
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 15,
        motivo: 'Taller 2',
        estado: 'pendiente'
      });

      const res = await request(app)
        .patch(`/api/reservas/${r.id}/rechazar`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('rechazada');
    });

    it('cancelar reserva responde 200 para usuario dueño y para admin', async () => {
      const r1 = await Reserva.create({
        aulaId: aulaActiva.id,
        usuarioId: usuarioUser.id,
        fecha: fechaFutura(14),
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 15,
        motivo: 'Taller Cancelar 1',
        estado: 'pendiente'
      });

      const resUsuario = await request(app)
        .patch(`/api/reservas/${r1.id}/cancelar`)
        .set('Authorization', `Bearer ${usuarioToken}`);
      expect(resUsuario.status).toBe(200);
      expect(resUsuario.body.estado).toBe('cancelada');

      const r2 = await Reserva.create({
        aulaId: aulaActiva.id,
        usuarioId: usuarioUser.id,
        fecha: fechaFutura(15),
        horaInicio: '08:00',
        horaFin: '10:00',
        cantidadPersonas: 15,
        motivo: 'Taller Cancelar 2',
        estado: 'pendiente'
      });

      const resAdmin = await request(app)
        .patch(`/api/reservas/${r2.id}/cancelar`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.estado).toBe('cancelada');
    });
  });

  describe('6. Aulas y Disponibilidad (aula.service.js / FormularioReserva.jsx)', () => {
    it('GET /api/aulas responde 200 para usuario autenticado', async () => {
      const res = await request(app)
        .get('/api/aulas')
        .set('Authorization', `Bearer ${usuarioToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /api/aulas/:id/disponibilidad responde 200 con fecha válida', async () => {
      const f = fechaFutura(3);
      const res = await request(app)
        .get(`/api/aulas/${aulaActiva.id}/disponibilidad?fecha=${f}`)
        .set('Authorization', `Bearer ${usuarioToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('7. ABM de Aulas para Administradores (Aulas.jsx / aula.service.js)', () => {
    it('GET /api/aulas?incluirInactivas=true responde 200 con todas las aulas para admin', async () => {
      await Aula.create({
        nombre: 'Aula de Prueba Inactiva',
        ubicacion: 'Subsuelo',
        capacidad: 15,
        activa: false
      });

      const res = await request(app)
        .get('/api/aulas?incluirInactivas=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((a) => a.activa === false)).toBe(true);
    });

    it('POST, PUT, PATCH desactivar y reactivar siguen el contrato del servicio frontend', async () => {
      // 1. POST
      const resPost = await request(app)
        .post('/api/aulas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Laboratorio de Software Libre',
          ubicacion: 'Pabellón Informática - Piso 1',
          capacidad: 35,
          recursos: 'PCs Linux, Proyector'
        });
      expect(resPost.status).toBe(201);
      const nuevaId = resPost.body.id;

      // 2. PUT
      const resPut = await request(app)
        .put(`/api/aulas/${nuevaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capacidad: 40,
          recursos: 'PCs Linux, Proyector, Pizarra'
        });
      expect(resPut.status).toBe(200);
      expect(resPut.body.capacidad).toBe(40);

      // 3. PATCH desactivar
      const resDesact = await request(app)
        .patch(`/api/aulas/${nuevaId}/desactivar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cancelarReservasFuturas: false
        });
      expect(resDesact.status).toBe(200);
      expect(resDesact.body.aula.activa).toBe(false);

      // 4. PATCH reactivar
      const resReact = await request(app)
        .patch(`/api/aulas/${nuevaId}/reactivar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(resReact.status).toBe(200);
      expect(resReact.body.activa).toBe(true);
    });
  });

  describe('CORS: cabeceras que el frontend realmente envía', () => {
    // El frontend manda Idempotency-Key al crear una reserva y X-Request-Id en
    // todas las peticiones. Si CORS no las permite, el navegador bloquea la
    // petición antes de que llegue al servidor: en las pruebas de API no se
    // nota, en la aplicación falla todo.
    const CABECERAS = ['content-type', 'authorization', 'idempotency-key', 'x-request-id'];

    it.each(CABECERAS)('el preflight permite la cabecera %s', async (cabecera) => {
      const res = await request(app)
        .options('/api/reservas')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', cabecera);

      expect([200, 204]).toContain(res.status);
      expect((res.headers['access-control-allow-headers'] || '').toLowerCase()).toContain(cabecera);
    });

    it('expone al navegador las cabeceras de respuesta que el frontend lee', async () => {
      const res = await request(app).get('/api/health/live').set('Origin', 'http://localhost:5173');

      const expuestas = (res.headers['access-control-expose-headers'] || '').toLowerCase();
      expect(expuestas).toContain('idempotent-replay');
      expect(expuestas).toContain('x-request-id');
    });
  });
});
