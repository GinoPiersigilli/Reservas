/**
 * Utilidades de formato de fecha y hora: dd/mm/aaaa y reloj de 24 h.
 *
 * Las fechas de una reserva son días de calendario (`aaaa-mm-dd`), no instantes:
 * se arman con `new Date(anio, mes - 1, dia)` para que el navegador no las
 * corra un día según la zona horaria.
 */

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

/** `aaaa-mm-dd` → Date local a medianoche, o null si la cadena no es una fecha. */
export function aFechaLocal(fechaStr) {
  if (!fechaStr) return null;
  const partes = String(fechaStr).slice(0, 10).split('-');
  if (partes.length !== 3) return null;
  const [anio, mes, dia] = partes.map(Number);
  if (!anio || !mes || !dia) return null;
  const fecha = new Date(anio, mes - 1, dia);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Fecha de hoy como `aaaa-mm-dd`, en la zona horaria del navegador. */
export function hoyISO(ahora = new Date()) {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/**
 * «hoy», «mañana» o «ayer» cuando corresponde; null para cualquier otro día.
 * Acompaña a la fecha, nunca la reemplaza.
 */
export function etiquetaRelativa(fechaStr, referenciaISO = hoyISO()) {
  const fecha = aFechaLocal(fechaStr);
  const referencia = aFechaLocal(referenciaISO);
  if (!fecha || !referencia) return null;
  const dias = Math.round((fecha - referencia) / 86400000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  return null;
}

/** «jueves 13 de noviembre» — encabezado de jornada en la agenda. */
export function formatearJornada(fechaStr) {
  const fecha = aFechaLocal(fechaStr);
  if (!fecha) return formatearFecha(fechaStr);
  return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

/** «jue 13 nov» — donde hace falta el día de la semana pero no hay lugar. */
export function formatearFechaCorta(fechaStr) {
  const fecha = aFechaLocal(fechaStr);
  if (!fecha) return formatearFecha(fechaStr);
  const dia = DIAS_SEMANA[fecha.getDay()].slice(0, 3);
  const mes = MESES[fecha.getMonth()].slice(0, 3);
  return `${dia} ${fecha.getDate()} ${mes}`;
}

export function formatearFecha(fechaStr) {
  if (!fechaStr) return '—';
  const limpia = String(fechaStr).slice(0, 10);
  const partes = limpia.split('-');
  if (partes.length === 3) {
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }
  const fecha = new Date(fechaStr);
  if (Number.isNaN(fecha.getTime())) return String(fechaStr);
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatearFechaHora(fechaHoraStr) {
  if (!fechaHoraStr) return '—';
  const fecha = new Date(fechaHoraStr);
  if (Number.isNaN(fecha.getTime())) return String(fechaHoraStr);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  const horas = String(fecha.getHours()).padStart(2, '0');
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
}

export function calcularDuracionTexto(horaInicio, horaFin) {
  if (!horaInicio || !horaFin) return '';
  const [h1, m1] = String(horaInicio).split(':').map(Number);
  const [h2, m2] = String(horaFin).split(':').map(Number);
  const minutos = (h2 - h1) * 60 + (m2 - m1);
  if (Number.isNaN(minutos) || minutos <= 0) return '';
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas > 0 && resto > 0) return `${horas} h ${resto} min`;
  if (horas > 0) return `${horas} h`;
  return `${resto} min`;
}
