import api from './axios.js';

export const getAulas = (incluirInactivas = false) => {
  const params = {};
  if (incluirInactivas) {
    params.incluirInactivas = true;
  }
  return api.get('/aulas', { params });
};

export const getDisponibilidadAula = (id, fecha) => {
  const params = {};
  if (
    fecha !== undefined &&
    fecha !== null &&
    !(typeof fecha === 'string' && fecha.trim() === '')
  ) {
    params.fecha = typeof fecha === 'string' ? fecha.trim() : fecha;
  }
  return api.get(`/aulas/${id}/disponibilidad`, { params });
};

export const getDisponibilidad = getDisponibilidadAula;

/**
 * La disponibilidad de todas las aulas activas en una fecha, en una consulta.
 *
 * La grilla necesita el día entero. Pedirlo aula por aula significaba una
 * petición por aula cada vez que alguien cambiaba la fecha, y con unas decenas
 * de aulas bastaban unos pocos cambios para agotar el límite por IP.
 */
export const getDisponibilidadDeTodas = (fecha) =>
  api.get('/aulas/disponibilidad', { params: { fecha: String(fecha).trim() } });

export const crearAula = (datos) => api.post('/aulas', datos);

export const editarAula = (id, datos) => api.put(`/aulas/${id}`, datos);

export const desactivarAula = (id, datos = {}) => api.patch(`/aulas/${id}/desactivar`, datos);

export const reactivarAula = (id) => api.patch(`/aulas/${id}/reactivar`);
