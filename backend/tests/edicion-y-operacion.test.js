import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import env from '../src/config/env.js';
import Usuario from '../src/models/usuario.model.js';
import Aula from '../src/models/aula.model.js';
import Reserva from '../src/models/reserva.model.js';
import HistorialReserva from '../src/models/historial.model.js';
import { hoyArgentina } from '../src/utils/fecha.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

/**
 * Lo que la auditoría encontró en la edición de reservas y en la baja de aulas:
 * cambios que no dejaban rastro, reservas ya terminadas tratadas como futuras,
 * y el panel calculando la ocupación contra un horario fijo en el código.
 */

let admin;
let tokenAdmin;

const crearAula = (nombre, capacidad = 40) =>
  Aula.create({ nombre, capacidad, ubicacion: 'Pabellón A', activa: true });

const manana = () => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
};

beforeEach(async () => {
  await limpiarBaseDeDatos();
  admin = await Usuario.create({
    nombre: 'Admin Auditoría',
    email: 'admin-auditoria@example.com',
    passwordHash: null,
    rol: 'admin',
    activo: true
  });
  tokenAdmin = jwt.sign(
    { id: admin.id, nombre: admin.nombre, email: admin.email, rol: admin.rol },
    env.JWT_SECRET,
    { algorithm: 'HS256', issuer: 'reservas-api', expiresIn: '2h' }
  );
});

afterAll(async () => {
  await sequelize.close();
});

describe('editar una reserva deja rastro de a dónde se movió', () => {
  it('el historial guarda el aula anterior y la nueva', async () => {
    const origen = await crearAula('Aula Origen');
    const destino = await crearAula('Aula Destino');

    const reserva = await Reserva.create({
      aulaId: origen.id,
      usuarioId: admin.id,
      fecha: manana(),
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 10,
      motivo: 'Clase',
      estado: 'aprobada'
    });

    const res = await request(app)
      .put(`/api/reservas/${reserva.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ aulaId: destino.id });

    expect(res.status).toBe(200);

    const entrada = await HistorialReserva.findOne({
      where: { reservaId: reserva.id, accion: 'edicion' },
      order: [['id', 'DESC']]
    });

    // Sin el aula en el historial, mover una reserva de aula no dejaba ver a
    // dónde se movió, aunque la pantalla de historial sí la muestra.
    expect(entrada.valorAnterior.aulaId).toBe(origen.id);
    expect(entrada.valorNuevo.aulaId).toBe(destino.id);
  });
});

describe('una reserva de hoy que ya terminó no es futura', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout'
      ]
    });
    jest.setSystemTime(new Date('2026-11-07T18:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Hoy a las 08:00–09:00: a media tarde eso ya pasó. */
  const reservaTempranaDeHoy = async (aulaId, usuarioId) => {
    const hoy = hoyArgentina();
    return Reserva.create({
      aulaId,
      usuarioId,
      fecha: hoy,
      horaInicio: '08:00',
      horaFin: '09:00',
      cantidadPersonas: 30,
      motivo: 'Clase que ya terminó',
      estado: 'aprobada'
    });
  };

  it('no bloquea bajar la capacidad del aula', async () => {
    const aula = await crearAula('Aula Mañanera', 40);
    await reservaTempranaDeHoy(aula.id, admin.id);

    const res = await request(app)
      .put(`/api/aulas/${aula.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ capacidad: 10 });

    // Con `fecha >= hoy` a secas, una reserva de las ocho de la mañana seguía
    // contando a las seis de la tarde y devolvía 409.
    expect(res.status).toBe(200);
  });

  it('no se cancela retroactivamente al dar de baja el aula', async () => {
    const aula = await crearAula('Aula de Baja', 40);
    const terminada = await reservaTempranaDeHoy(aula.id, admin.id);

    const res = await request(app)
      .patch(`/api/aulas/${aula.id}/desactivar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ motivo: 'Refacción del pabellón', cancelarReservasFuturas: true });

    expect(res.status).toBe(200);

    await terminada.reload();
    expect(terminada.estado).toBe('aprobada');
  });

  it('pero las que todavía no empezaron sí se cancelan, con su registro', async () => {
    const aula = await crearAula('Aula Futura', 40);
    const futura = await Reserva.create({
      aulaId: aula.id,
      usuarioId: admin.id,
      fecha: manana(),
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 10,
      motivo: 'Clase que viene',
      estado: 'aprobada'
    });

    const res = await request(app)
      .patch(`/api/aulas/${aula.id}/desactivar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ motivo: 'Refacción del pabellón', cancelarReservasFuturas: true });

    expect(res.status).toBe(200);

    await futura.reload();
    expect(futura.estado).toBe('cancelada');

    // El lote tiene que registrar igual que el bucle de a una que reemplazó.
    const entrada = await HistorialReserva.findOne({
      where: { reservaId: futura.id, accion: 'cancelada' }
    });
    expect(entrada).not.toBeNull();
    expect(entrada.usuarioId).toBe(admin.id);
    expect(entrada.valorAnterior.estado).toBe('aprobada');
    expect(entrada.valorNuevo.motivo).toContain('Refacción del pabellón');
  });
});

describe('la ocupación del panel sale del horario configurado', () => {
  it('las horas disponibles son las de WORK_HOUR_START a WORK_HOUR_END', async () => {
    await crearAula('Aula Panel');

    const res = await request(app)
      .get('/api/reservas/resumen')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);

    const [hI, mI] = env.WORK_HOUR_START.split(':').map(Number);
    const [hF, mF] = env.WORK_HOUR_END.split(':').map(Number);
    const horasPorDia = (hF * 60 + mF - (hI * 60 + mI)) / 60;

    const hoy = hoyArgentina();
    const [anio, mes] = hoy.split('-').map(Number);
    const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

    const aulaPanel = res.body.tasaOcupacionAulas.find((a) => a.nombre === 'Aula Panel');
    expect(aulaPanel.horasDisponibles).toBe(diasDelMes * horasPorDia);
  });

  it('suma las horas ocupadas de cada aula', async () => {
    const aula = await crearAula('Aula Ocupada');
    const hoy = hoyArgentina();

    await Reserva.create({
      aulaId: aula.id,
      usuarioId: admin.id,
      fecha: hoy,
      horaInicio: '08:00',
      horaFin: '10:00',
      cantidadPersonas: 10,
      motivo: 'Dos horas',
      estado: 'aprobada'
    });
    await Reserva.create({
      aulaId: aula.id,
      usuarioId: admin.id,
      fecha: hoy,
      horaInicio: '14:00',
      horaFin: '17:30',
      cantidadPersonas: 10,
      motivo: 'Tres horas y media',
      estado: 'aprobada'
    });

    const res = await request(app)
      .get('/api/reservas/resumen')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const aulaOcupada = res.body.tasaOcupacionAulas.find((a) => a.nombre === 'Aula Ocupada');
    expect(aulaOcupada.horasOcupadas).toBeCloseTo(5.5, 1);
  });
});
