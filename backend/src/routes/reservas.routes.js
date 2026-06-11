import express from 'express';
import { verificarToken, soloAdmin } from '../middleware/auth.middleware.js';

// ¡ACÁ ESTÁ EL CAMBIO! Traemos todas las funciones reales de tu controlador
import * as reservasController from '../controllers/reservas.controller.js';

const router = express.Router();

// Rutas públicas (no tienen el control en el medio)
router.get('/resumen', reservasController.obtenerResumen); 
router.get('/', reservasController.listarReservas); 

// Rutas protegidas (Usuario logueado)
router.post('/', verificarToken, reservasController.crearReserva); 
router.get('/:id', verificarToken, reservasController.obtenerReservaPorId); 
// Ojo acá: le puse "obtenerHistorialDeReserva" para que coincida exactamente con el nombre que usamos en el controlador
router.get('/:id/historial', verificarToken, reservasController.obtenerHistorialDeReserva); 

// Rutas de administrador (tienen doble control)
router.put('/:id', verificarToken, soloAdmin, reservasController.editarReserva); 
router.patch('/:id/aprobar', verificarToken, soloAdmin, reservasController.aprobarReserva); 
router.patch('/:id/rechazar', verificarToken, soloAdmin, reservasController.rechazarReserva); 

// ¡PEQUEÑA CORRECCIÓN ACÁ!
// Le saqué el "soloAdmin" a la ruta de cancelar.
router.patch('/:id/cancelar', verificarToken, reservasController.cancelarReserva); 

export default router;