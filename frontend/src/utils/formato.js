/**
 * Utilidades de formato de fecha y hora — dd/mm/aaaa y 24 h (Sección 9 de DISENO_PROPUESTA.md).
 */

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

