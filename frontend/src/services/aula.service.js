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
  if (fecha !== undefined && fecha !== null && !(typeof fecha === 'string' && fecha.trim() === '')) {
    params.fecha = typeof fecha === 'string' ? fecha.trim() : fecha;
  }
  return api.get(`/aulas/${id}/disponibilidad`, { params });
};

export const getDisponibilidad = getDisponibilidadAula;

export const crearAula = (datos) =>
  api.post('/aulas', datos);

export const editarAula = (id, datos) =>
  api.put(`/aulas/${id}`, datos);

export const desactivarAula = (id, datos = {}) =>
  api.patch(`/aulas/${id}/desactivar`, datos);

export const reactivarAula = (id) =>
  api.patch(`/aulas/${id}/reactivar`);
