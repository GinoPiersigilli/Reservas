import express from 'express';
// Acá importarías tus funciones desde el controlador y tus middlewares
// import reservasController from '../controllers/reservas.controller.js';
// import { verificarToken, verificarRolAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// --- RUTAS GENERALES ---

// GET /api/reservas/resumen - Resumen para administración
// IMPORTANTE: Esta ruta DEBE ir antes que las que tienen /:id
router.get('/resumen', reservasController.obtenerResumen); // 

// GET /api/reservas - Lista las reservas (acá por query params llegarán los filtros)
router.get('/', reservasController.listarReservas); // [cite: 101]

// POST /api/reservas - Crea una nueva reserva
router.post('/', reservasController.crearReserva); // [cite: 105]


// --- RUTAS CON ID DE RESERVA ---

// GET /api/reservas/:id - Ver detalle de una reserva específica
router.get('/:id', reservasController.obtenerReservaPorId); // [cite: 103]

// GET /api/reservas/:id/historial - Ver historial de cambios
router.get('/:id/historial', reservasController.obtenerHistorial); // [cite: 104]

// PUT /api/reservas/:id - Editar una reserva
router.put('/:id', reservasController.editarReserva); // [cite: 106]


// --- ACCIONES DE ESTADO (PATCH) ---

// PATCH /api/reservas/:id/cancelar
router.patch('/:id/cancelar', reservasController.cancelarReserva); // [cite: 107]

// PATCH /api/reservas/:id/aprobar
router.patch('/:id/aprobar', reservasController.aprobarReserva); // [cite: 108]

// PATCH /api/reservas/:id/rechazar
router.patch('/:id/rechazar', reservasController.rechazarReserva); // [cite: 109]

export default router;