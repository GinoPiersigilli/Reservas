import {
  aFechaLocal,
  etiquetaRelativa,
  formatearFecha,
  formatearFechaCorta,
  formatearJornada,
  hoyISO
} from '../formato.js';

describe('formato de fechas', () => {
  it('interpreta aaaa-mm-dd como día de calendario, sin correrlo por zona horaria', () => {
    const fecha = aFechaLocal('2026-11-13');
    expect(fecha.getFullYear()).toBe(2026);
    expect(fecha.getMonth()).toBe(10);
    expect(fecha.getDate()).toBe(13);
  });

  it('devuelve null cuando la cadena no es una fecha', () => {
    expect(aFechaLocal('')).toBeNull();
    expect(aFechaLocal('mañana')).toBeNull();
    expect(aFechaLocal(null)).toBeNull();
  });

  it('arma el encabezado de jornada con día de la semana y mes', () => {
    expect(formatearJornada('2026-11-13')).toBe('viernes 13 de noviembre');
    expect(formatearJornada('2026-01-01')).toBe('jueves 1 de enero');
  });

  it('abrevia la fecha sin perder el día de la semana', () => {
    expect(formatearFechaCorta('2026-11-13')).toBe('vie 13 nov');
  });

  it('mantiene dd/mm/aaaa donde la fecha es un dato de tabla', () => {
    expect(formatearFecha('2026-11-13')).toBe('13/11/2026');
  });

  it('solo etiqueta ayer, hoy y mañana', () => {
    expect(etiquetaRelativa('2026-11-13', '2026-11-13')).toBe('hoy');
    expect(etiquetaRelativa('2026-11-14', '2026-11-13')).toBe('mañana');
    expect(etiquetaRelativa('2026-11-12', '2026-11-13')).toBe('ayer');
    expect(etiquetaRelativa('2026-11-15', '2026-11-13')).toBeNull();
  });

  it('cruza el cambio de mes y el horario de verano sin desfasarse', () => {
    expect(etiquetaRelativa('2026-12-01', '2026-11-30')).toBe('mañana');
    expect(etiquetaRelativa('2026-03-01', '2026-02-28')).toBe('mañana');
  });

  it('expresa hoy como aaaa-mm-dd con dos dígitos', () => {
    expect(hoyISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
