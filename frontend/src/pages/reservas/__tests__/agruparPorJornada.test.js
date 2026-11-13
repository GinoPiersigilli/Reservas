import { agruparPorJornada } from '../agruparPorJornada.js';

const reserva = (id, fecha, horaInicio) => ({ id, fecha, horaInicio, horaFin: '12:00' });

describe('agruparPorJornada', () => {
  it('agrupa por día y ordena las jornadas de la más vieja a la más nueva', () => {
    const jornadas = agruparPorJornada(
      [reserva(1, '2026-11-14', '09:00'), reserva(2, '2026-11-13', '10:00')],
      '2026-11-13'
    );

    expect(jornadas.map((j) => j.fecha)).toEqual(['2026-11-13', '2026-11-14']);
    expect(jornadas[0].titulo).toBe('viernes 13 de noviembre');
  });

  it('ordena las reservas de una jornada por hora de inicio', () => {
    const [jornada] = agruparPorJornada([
      reserva(1, '2026-11-13', '16:00'),
      reserva(2, '2026-11-13', '08:00'),
      reserva(3, '2026-11-13', '11:30')
    ]);

    expect(jornada.reservas.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('marca hoy y mañana, y deja el resto sin etiqueta', () => {
    const jornadas = agruparPorJornada(
      [
        reserva(1, '2026-11-13', '09:00'),
        reserva(2, '2026-11-14', '09:00'),
        reserva(3, '2026-11-20', '09:00')
      ],
      '2026-11-13'
    );

    expect(jornadas.map((j) => j.relativa)).toEqual(['hoy', 'mañana', null]);
  });

  it('acepta fechas con hora y descarta las reservas sin fecha', () => {
    const jornadas = agruparPorJornada([
      { id: 1, fecha: '2026-11-13T00:00:00.000Z', horaInicio: '09:00' },
      { id: 2, horaInicio: '10:00' }
    ]);

    expect(jornadas).toHaveLength(1);
    expect(jornadas[0].fecha).toBe('2026-11-13');
  });

  it('no devuelve jornadas cuando no hay reservas', () => {
    expect(agruparPorJornada([])).toEqual([]);
  });
});
