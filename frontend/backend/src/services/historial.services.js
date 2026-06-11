// src/services/historial.services.js
import HistorialReserva from '../models/historial.model.js';

export const registrarAccion = async (reservaId, usuarioId, accion, valorAnterior, valorNuevo) => {
  await HistorialReserva.create({
    reservaId,
    usuarioId,
    accion,
    fechaHora: new Date(),
    valorAnterior: valorAnterior || null,
    valorNuevo: valorNuevo || null
  });
};