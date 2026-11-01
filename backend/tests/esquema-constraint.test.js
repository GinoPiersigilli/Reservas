import sequelize from '../src/config/database.js';
import { Usuario, Aula, Reserva } from '../src/models/index.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

let usuario;
let aula;

beforeEach(async () => {
  await limpiarBaseDeDatos();

  usuario = await Usuario.create({
    nombre: 'Usuario Constraint',
    email: 'constraint@test.com',
    passwordHash: null,
    clerkId: 'user_clerk_constraint_1',
    rol: 'usuario',
    activo: true
  });

  aula = await Aula.create({
    nombre: 'Aula Constraint',
    ubicacion: 'Edificio Central',
    capacidad: 30,
    recursos: 'proyector',
    activa: true
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe('PostgreSQL exclusion constraint (reservas_sin_solapamiento) & schema checks', () => {
  it('rechaza directamente en la base dos reservas solapadas en la misma aula y fecha', async () => {
    await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: '2026-07-15',
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 15,
      motivo: 'Reserva inicial',
      estado: 'pendiente'
    });

    await expect(
      Reserva.create({
        aulaId: aula.id,
        usuarioId: usuario.id,
        fecha: '2026-07-15',
        horaInicio: '11:00',
        horaFin: '13:00',
        cantidadPersonas: 10,
        motivo: 'Reserva solapada directo a BD',
        estado: 'aprobada'
      })
    ).rejects.toMatchObject({
      parent: {
        code: '23P01',
        constraint: 'reservas_sin_solapamiento'
      }
    });
  });

  it('permite reservas consecutivas que se tocan en el borde exacto (10:00-11:00 y 11:00-12:00)', async () => {
    const primera = await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: '2026-07-16',
      horaInicio: '10:00',
      horaFin: '11:00',
      cantidadPersonas: 10,
      motivo: 'Primera franja',
      estado: 'aprobada'
    });

    const segunda = await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: '2026-07-16',
      horaInicio: '11:00',
      horaFin: '12:00',
      cantidadPersonas: 12,
      motivo: 'Segunda franja consecutiva',
      estado: 'pendiente'
    });

    expect(primera.horaInicio).toBe('10:00');
    expect(primera.horaFin).toBe('11:00');
    expect(segunda.horaInicio).toBe('11:00');
    expect(segunda.horaFin).toBe('12:00');
  });

  it('no bloquea el horario cuando existe una reserva cancelada o rechazada en la misma franja', async () => {
    await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: '2026-07-17',
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 10,
      motivo: 'Reserva cancelada previa',
      estado: 'cancelada'
    });

    const nuevaActiva = await Reserva.create({
      aulaId: aula.id,
      usuarioId: usuario.id,
      fecha: '2026-07-17',
      horaInicio: '10:00',
      horaFin: '12:00',
      cantidadPersonas: 15,
      motivo: 'Nueva reserva en horario liberado',
      estado: 'pendiente'
    });

    expect(nuevaActiva.id).toBeDefined();
    expect(nuevaActiva.estado).toBe('pendiente');
  });
});
