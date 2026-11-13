// src/services/historial.services.js
import HistorialReserva from '../models/historial.model.js';
import HistorialAula from '../models/historialAula.model.js';

/**
 * Acepta tanto `{ transaction }` como la transacción directamente, porque
 * ambas formas se usan en los servicios.
 */
const normalizarOpciones = (options = {}) => {
  if (options?.transaction) return { transaction: options.transaction };
  if (options && typeof options.commit === 'function') return { transaction: options };
  return {};
};

/**
 * Crea un registrador de auditoría para una entidad: el historial siempre se
 * escribe en la misma transacción que la operación auditada.
 */
const crearRegistrador =
  (Modelo, campoId) =>
  async (idEntidad, usuarioId, accion, valorAnterior, valorNuevo, options = {}) => {
    await Modelo.create(
      {
        [campoId]: idEntidad,
        usuarioId,
        accion,
        fechaHora: new Date(),
        valorAnterior: valorAnterior || null,
        valorNuevo: valorNuevo || null
      },
      normalizarOpciones(options)
    );
  };

export const registrarAccion = crearRegistrador(HistorialReserva, 'reservaId');
export const registrarAccionAula = crearRegistrador(HistorialAula, 'aulaId');
