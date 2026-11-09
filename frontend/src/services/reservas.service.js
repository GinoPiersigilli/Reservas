import api from './axios.js';

export const getReservas = (params = {}) => {
  const cleanParams = {};
  if (params && typeof params === 'object') {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && !(typeof val === 'string' && val.trim() === '')) {
        cleanParams[key] = typeof val === 'string' ? val.trim() : val;
      }
    }
  }
  return api.get('/reservas', { params: cleanParams });
};

export const getReserva = (id) =>
  api.get(`/reservas/${id}`);

export const getHistorial = (id) =>
  api.get(`/reservas/${id}/historial`);

export const getResumen = () =>
  api.get('/reservas/resumen');

export const crearReserva = (datos) =>
  api.post('/reservas', datos);

export const editarReserva = (id, datos) =>
  api.put(`/reservas/${id}`, datos);

export const aprobarReserva = (id) =>
  api.patch(`/reservas/${id}/aprobar`);

export const rechazarReserva = (id) =>
  api.patch(`/reservas/${id}/rechazar`);

export const cancelarReserva = (id) =>
  api.patch(`/reservas/${id}/cancelar`);