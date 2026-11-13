import { etiquetaRelativa, formatearJornada, hoyISO } from '../../utils/formato.js';

const clave = (reserva) => String(reserva?.fecha || '').slice(0, 10);

const porHorario = (a, b) => String(a.horaInicio || '').localeCompare(String(b.horaInicio || ''));

/**
 * Agrupa las reservas de la página actual por día de calendario.
 *
 * Solo agrupa lo que llegó: la paginación la resuelve el backend, así que una
 * jornada puede continuar en la página siguiente. Por eso la agenda pide
 * siempre el listado ordenado por fecha.
 *
 * @param {Array} reservas  Reservas de la página.
 * @param {string} [referenciaISO]  Día que cuenta como «hoy».
 * @returns {Array<{fecha: string, titulo: string, relativa: string|null, reservas: Array}>}
 */
export function agruparPorJornada(reservas = [], referenciaISO = hoyISO()) {
  const jornadas = new Map();

  reservas.forEach((reserva) => {
    const fecha = clave(reserva);
    if (!fecha) return;
    if (!jornadas.has(fecha)) jornadas.set(fecha, []);
    jornadas.get(fecha).push(reserva);
  });

  return Array.from(jornadas.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, lista]) => ({
      fecha,
      titulo: formatearJornada(fecha),
      relativa: etiquetaRelativa(fecha, referenciaISO),
      reservas: [...lista].sort(porHorario)
    }));
}

export default agruparPorJornada;
