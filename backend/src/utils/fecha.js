export const ZONA_ARGENTINA = 'America/Argentina/Cordoba';
export const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const hoyArgentina = (date = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
};

export const horaActualArgentina = (date = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_ARGENTINA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  const hora = mapa.hour === '24' ? '00' : mapa.hour;
  return `${hora}:${mapa.minute}`;
};

export const esFechaValida = (fechaStr) => {
  if (typeof fechaStr !== 'string' || !FECHA_REGEX.test(fechaStr)) {
    return false;
  }

  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
};

export const esFechaPasada = (fechaStr, date = new Date()) => {
  return fechaStr < hoyArgentina(date);
};

export const esHorarioPasado = (fechaStr, horaInicioStr, date = new Date()) => {
  if (esFechaPasada(fechaStr, date)) {
    return true;
  }
  if (fechaStr === hoyArgentina(date)) {
    const horaActual = horaActualArgentina(date);
    return horaInicioStr <= horaActual;
  }
  return false;
};
