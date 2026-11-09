import api from './axios.js';

export const getAulas = () =>
  api.get('/aulas');

export const getDisponibilidadAula = (id, fecha) => {
  const params = {};
  if (fecha !== undefined && fecha !== null && !(typeof fecha === 'string' && fecha.trim() === '')) {
    params.fecha = typeof fecha === 'string' ? fecha.trim() : fecha;
  }
  return api.get(`/aulas/${id}/disponibilidad`, { params });
};

export const getDisponibilidad = getDisponibilidadAula;
