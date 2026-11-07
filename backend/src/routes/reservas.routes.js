import express from 'express';
import * as reservasController from '../controllers/reservas.controller.js';
import { validarCrearReserva, validarEditarReserva } from '../middleware/validacion.middleware.js';
import { verificarToken, soloAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/resumen',verificarToken,soloAdmin,reservasController.obtenerResumen);
router.get('/',verificarToken,reservasController.listarReservas);

router.post('/', verificarToken, validarCrearReserva, reservasController.crearReserva);
router.get('/:id', verificarToken, reservasController.obtenerReservaPorId);
router.get('/:id/historial', verificarToken, reservasController.obtenerHistorialDeReserva);

router.put('/:id', verificarToken, soloAdmin, validarEditarReserva, reservasController.editarReserva);
router.patch('/:id/aprobar', verificarToken, soloAdmin, reservasController.aprobarReserva);
router.patch('/:id/rechazar', verificarToken, soloAdmin, reservasController.rechazarReserva);
router.patch('/:id/cancelar', verificarToken, reservasController.cancelarReserva);

export default router;