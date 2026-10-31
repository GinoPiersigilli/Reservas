// src/controllers/reservas.controller.js
import * as reservasService from '../services/reservas.services.js';

// ==========================================
// CREAR RESERVA
// ==========================================
export const crearReserva = async (req, res, next) => {
  try {
    const datosReserva = req.body;
    datosReserva.usuarioId = req.usuario.id; // ← descomentado y limpio
    const nuevaReserva = await reservasService.crearNuevaReserva(datosReserva);
    res.status(201).json(nuevaReserva);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// APROBAR RESERVA
// ==========================================
export const aprobarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioIdAdmin = req.usuario.id;

    const reservaAprobada = await reservasService.aprobarReserva(id, usuarioIdAdmin);

    // Status HTTP 200 coherente para modificaciones exitosas [cite: 119]
    res.status(200).json(reservaAprobada);

  } catch (error) {
    next(error);
  }
};

// ==========================================
// VER HISTORIAL DE UNA RESERVA
// ==========================================
export const obtenerHistorialDeReserva = async (req, res, next) => {
  try {
    const { id } = req.params; // El ID de la reserva
    const historial = await reservasService.obtenerHistorialDeReserva(id, req.usuario);

    res.status(200).json(historial);

  } catch (error) {
    next(error);
  }
};

export const cancelarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioLogueado = req.usuario;

    const reservaCancelada = await reservasService.cancelarReserva(id, usuarioLogueado);

    res.status(200).json(reservaCancelada);

  } catch (error) {
    next(error);
  }
};

export const listarReservas = async (req, res, next) => {
  try {
    const { fecha, estado, aulaId, q, page, limit, sortBy, order } = req.query;
    const reservas = await reservasService.obtenerReservas(
      { fecha, estado, aulaId, q, page, limit, sortBy, order },
      req.usuario
    );
    res.status(200).json(reservas);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// OBTENER RESERVA POR ID
// ==========================================
export const obtenerReservaPorId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reserva = await reservasService.obtenerReservaPorId(id, req.usuario);
    res.status(200).json(reserva);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// EDITAR RESERVA
// ==========================================
export const editarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const datos  = req.body;
    const usuarioIdAdmin = req.usuario.id;
    const reservaEditada = await reservasService.editarReserva(id, datos, usuarioIdAdmin);
    res.status(200).json(reservaEditada);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// OBTENER RESUMEN
// ==========================================
export const obtenerResumen = async (req, res, next) => {
  try {
    const resumen = await reservasService.obtenerResumen();
    res.status(200).json(resumen);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// RECHAZAR RESERVA
// ==========================================
export const rechazarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioIdAdmin = req.usuario.id;
    const reservaRechazada = await reservasService.rechazarReserva(id, usuarioIdAdmin);
    res.status(200).json(reservaRechazada);
  } catch (error) {
    next(error);
  }
};
