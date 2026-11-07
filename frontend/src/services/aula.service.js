import api from './axios.js';

export const getAulas = () =>
  api.get('/aulas');

export const getDisponibilidadAula = (id, fecha) =>
  api.get(`/aulas/${id}/disponibilidad`, { params: { fecha } });

export const getDisponibilidad = getDisponibilidadAula;
