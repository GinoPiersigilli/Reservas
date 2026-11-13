import { describe, it, expect } from 'vitest';
import {
  BLOQUES,
  calcularSegmentosFila,
  calcularTramos,
  hayOcupacionEnRango,
  ocupacionDelBloque
} from '../grillaCalculos.js';

const franja = (horaInicio, horaFin, estado = 'aprobada', id) => ({
  id,
  horaInicio,
  horaFin,
  estado
});

const bloqueDe = (hora) => BLOQUES.find((b) => b.inicio === hora);

const CONTEXTO = {
  hayFecha: true,
  esHoy: false,
  minutosAhora: 0,
  mismaAula: false,
  inicioSelMin: NaN,
  finSelMin: NaN
};

describe('ocupacionDelBloque', () => {
  it('encuentra la franja que cubre el bloque', () => {
    const franjas = [franja('10:00', '11:00')];

    expect(ocupacionDelBloque(franjas, bloqueDe('10:30'))).toBe(franjas[0]);
    expect(ocupacionDelBloque(franjas, bloqueDe('11:00'))).toBeUndefined();
  });

  it('trata el fin de una franja como libre (rango semiabierto)', () => {
    // Una reserva de 10 a 12 y otra de 12 a 14 no se solapan.
    const franjas = [franja('10:00', '12:00')];

    expect(ocupacionDelBloque(franjas, bloqueDe('12:00'))).toBeUndefined();
  });
});

describe('hayOcupacionEnRango', () => {
  const franjas = [franja('14:00', '15:00')];

  it('detecta un choque parcial', () => {
    expect(hayOcupacionEnRango(franjas, 14 * 60 + 30, 16 * 60)).toBe(true);
  });

  it('acepta un rango contiguo sin superposición', () => {
    expect(hayOcupacionEnRango(franjas, 15 * 60, 16 * 60)).toBe(false);
    expect(hayOcupacionEnRango(franjas, 13 * 60, 14 * 60)).toBe(false);
  });
});

describe('calcularSegmentosFila', () => {
  it('sin fecha elegida, todas las franjas quedan libres', () => {
    const segmentos = calcularSegmentosFila([franja('10:00', '11:00')], {
      ...CONTEXTO,
      hayFecha: false
    });

    expect(segmentos).toHaveLength(BLOQUES.length);
    expect(segmentos.every((s) => s.tipo === 'libre')).toBe(true);
  });

  it('une en un solo segmento los bloques de una misma reserva', () => {
    const segmentos = calcularSegmentosFila([franja('10:00', '12:00', 'aprobada', 7)], CONTEXTO);

    const ocupados = segmentos.filter((s) => s.tipo === 'ocupada');
    expect(ocupados).toHaveLength(1);
    // Dos horas son cuatro bloques de media hora.
    expect(ocupados[0].span).toBe(4);
    expect(ocupados[0].bloqueInicio.inicio).toBe('10:00');
    expect(ocupados[0].bloqueFin.fin).toBe('12:00');
  });

  it('no une dos reservas distintas que son contiguas', () => {
    const segmentos = calcularSegmentosFila(
      [franja('10:00', '11:00', 'aprobada', 1), franja('11:00', '12:00', 'pendiente', 2)],
      CONTEXTO
    );

    const ocupados = segmentos.filter((s) => s.tipo === 'ocupada');
    expect(ocupados).toHaveLength(2);
    expect(ocupados.map((s) => s.span)).toEqual([2, 2]);
  });

  it('marca como pasadas las franjas ya transcurridas de hoy', () => {
    const segmentos = calcularSegmentosFila([], {
      ...CONTEXTO,
      esHoy: true,
      minutosAhora: 10 * 60 // 10:00
    });

    expect(segmentos.find((s) => s.bloque.inicio === '09:00').esPasado).toBe(true);
    expect(segmentos.find((s) => s.bloque.inicio === '10:00').esPasado).toBe(false);
  });

  it('marca como seleccionadas solo las franjas del rango elegido en esa aula', () => {
    const contexto = {
      ...CONTEXTO,
      mismaAula: true,
      inicioSelMin: 14 * 60,
      finSelMin: 15 * 60
    };

    const segmentos = calcularSegmentosFila([], contexto);
    const seleccionadas = segmentos.filter((s) => s.estaSeleccionada).map((s) => s.bloque.inicio);

    expect(seleccionadas).toEqual(['14:00', '14:30']);
  });

  it('no marca selección si el rango corresponde a otra aula', () => {
    const segmentos = calcularSegmentosFila([], {
      ...CONTEXTO,
      mismaAula: false,
      inicioSelMin: 14 * 60,
      finSelMin: 15 * 60
    });

    expect(segmentos.some((s) => s.estaSeleccionada)).toBe(false);
  });
});

describe('calcularTramos', () => {
  const reloj = { esHoy: false, minutosAhora: 0 };

  it('devuelve toda la jornada como un tramo libre cuando no hay reservas', () => {
    const { ocupadas, libres } = calcularTramos([], reloj);

    expect(ocupadas).toHaveLength(0);
    expect(libres).toEqual([expect.objectContaining({ horaInicio: '08:00', horaFin: '22:00' })]);
  });

  it('agrupa los huecos entre reservas', () => {
    const { libres } = calcularTramos([franja('10:00', '11:00'), franja('14:00', '16:00')], reloj);

    expect(libres.map((t) => `${t.horaInicio}-${t.horaFin}`)).toEqual([
      '08:00-10:00',
      '11:00-14:00',
      '16:00-22:00'
    ]);
  });

  it('ordena las reservas y agrega su texto de estado', () => {
    const { ocupadas } = calcularTramos(
      [franja('16:00', '17:00', 'pendiente'), franja('09:00', '10:00', 'aprobada')],
      reloj
    );

    expect(ocupadas.map((o) => o.rangoTexto)).toEqual(['09:00\u201310:00', '16:00\u201317:00']);
    expect(ocupadas[0].nombreEstado).toBe('Aprobada');
    expect(ocupadas[1].nombreEstado).toBe('Pendiente');
  });

  it('en el día de hoy arranca en la próxima media hora', () => {
    const { libres } = calcularTramos([], { esHoy: true, minutosAhora: 10 * 60 + 10 });

    expect(libres[0].horaInicio).toBe('10:30');
  });

  it('descarta las reservas que ya terminaron hoy', () => {
    const { libres } = calcularTramos([franja('08:00', '09:00')], {
      esHoy: true,
      minutosAhora: 12 * 60
    });

    expect(libres).toEqual([expect.objectContaining({ horaInicio: '12:00', horaFin: '22:00' })]);
  });
});
