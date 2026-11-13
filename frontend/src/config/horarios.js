/**
 * Configuración única de la franja horaria laboral y la resolución de la grilla.
 */

export const HORA_INICIO_JORNADA = '08:00';
export const HORA_FIN_JORNADA = '22:00';
export const PASO_MINUTOS = 30;

export function horaAMinutos(horaStr) {
  if (!horaStr || typeof horaStr !== 'string') return NaN;
  const partes = horaStr.slice(0, 5).split(':');
  if (partes.length !== 2) return NaN;
  const h = Number(partes[0]);
  const m = Number(partes[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

export function minutosAHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const MINUTOS_INICIO_JORNADA = horaAMinutos(HORA_INICIO_JORNADA);
export const MINUTOS_FIN_JORNADA = horaAMinutos(HORA_FIN_JORNADA);

export function generarBloquesJornada() {
  const bloques = [];
  for (let min = MINUTOS_INICIO_JORNADA; min < MINUTOS_FIN_JORNADA; min += PASO_MINUTOS) {
    bloques.push({
      inicio: minutosAHora(min),
      fin: minutosAHora(min + PASO_MINUTOS),
      inicioMin: min,
      finMin: min + PASO_MINUTOS
    });
  }
  return bloques;
}

export function generarCabecerasHoras() {
  const horas = [];
  for (let min = MINUTOS_INICIO_JORNADA; min < MINUTOS_FIN_JORNADA; min += 60) {
    horas.push({
      hora: minutosAHora(min),
      etiqueta: String(Math.floor(min / 60)).padStart(2, '0')
    });
  }
  return horas;
}

export function obtenerHoyArgentina() {
  try {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Cordoba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const y = partes.find((p) => p.type === 'year')?.value;
    const m = partes.find((p) => p.type === 'month')?.value;
    const d = partes.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback local
  }
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function obtenerMinutosAhoraArgentina() {
  try {
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Argentina/Cordoba',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const h = Number(partes.find((p) => p.type === 'hour')?.value);
    const m = Number(partes.find((p) => p.type === 'minute')?.value);
    if (!Number.isNaN(h) && !Number.isNaN(m)) return h * 60 + m;
  } catch {
    // Fallback local
  }
  const ahora = new Date();
  return ahora.getHours() * 60 + ahora.getMinutes();
}
