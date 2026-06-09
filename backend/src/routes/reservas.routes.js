import express from 'express';
// Acá importamos todas las funciones de tu controlador
import * as reservasController from '../controllers/reservas.controller.js';

// (Más adelante, cuando armes el middleware de autenticación, vas a descomentar esto)
// import { verificarToken, verificarRolAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// --- RUTAS GENERALES ---

// GET /api/reservas/resumen - Resumen para administración [cite: 102]
// IMPORTANTE: Esta ruta DEBE ir antes que las que tienen /:id
router.get('/resumen', reservasController.obtenerResumen); 

// GET /api/reservas - Lista las reservas con filtros [cite: 101]
router.get('/', reservasController.listarReservas); 

// POST /api/reservas - Crea una nueva reserva [cite: 105]
router.post('/', reservasController.crearReserva); 


// --- RUTAS CON ID DE RESERVA ---

// GET /api/reservas/:id - Ver detalle de una reserva específica [cite: 103]
router.get('/:id', reservasController.obtenerReservaPorId); 

// GET /api/reservas/:id/historial - Ver historial de cambios [cite: 104]
router.get('/:id/historial', reservasController.obtenerHistorial); 

// PUT /api/reservas/:id - Editar una reserva [cite: 106]
router.put('/:id', reservasController.editarReserva); 


// --- ACCIONES DE ESTADO (PATCH) ---

// PATCH /api/reservas/:id/cancelar [cite: 107]
router.patch('/:id/cancelar', reservasController.cancelarReserva); 

// PATCH /api/reservas/:id/aprobar [cite: 108]
router.patch('/:id/aprobar', reservasController.aprobarReserva); 

// PATCH /api/reservas/:id/rechazar [cite: 109]
router.patch('/:id/rechazar', reservasController.rechazarReserva); 

export default router;