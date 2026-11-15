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

/**
 * La misma fila que `crearRegistrador`, pero para varias de una vez.
 *
 * Existe para que quien registre en lote no tenga que repetir la forma de la
 * fila: si algún día el historial suma una columna, se agrega acá y vale para
 * los dos caminos.
 */
const crearRegistradorEnLote =
  (Modelo, campoId) =>
  async (entradas, options = {}) => {
    if (entradas.length === 0) return;

    const fechaHora = new Date();
    await Modelo.bulkCreate(
      entradas.map((entrada) => ({
        [campoId]: entrada.idEntidad,
        usuarioId: entrada.usuarioId,
        accion: entrada.accion,
        fechaHora,
        valorAnterior: entrada.valorAnterior || null,
        valorNuevo: entrada.valorNuevo || null
      })),
      normalizarOpciones(options)
    );
  };

export const registrarAccion = crearRegistrador(HistorialReserva, 'reservaId');
export const registrarAccionesEnLote = crearRegistradorEnLote(HistorialReserva, 'reservaId');
export const registrarAccionAula = crearRegistrador(HistorialAula, 'aulaId');
