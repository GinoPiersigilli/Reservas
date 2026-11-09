import express from 'express';
import * as reservasController from '../controllers/reservas.controller.js';
import { validarCrearReserva, validarEditarReserva, validar, idParamSchema } from '../middleware/validacion.middleware.js';
import { verificarToken, soloAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/resumen',verificarToken,soloAdmin,reservasController.obtenerResumen);
router.get('/',verificarToken,reservasController.listarReservas);

router.post('/', verificarToken, validarCrearReserva, reservasController.crearReserva);
router.get('/:id', verificarToken, validar(idParamSchema, 'params'), reservasController.obtenerReservaPorId);
router.get('/:id/historial', verificarToken, validar(idParamSchema, 'params'), reservasController.obtenerHistorialDeReserva);

router.put('/:id', verificarToken, soloAdmin, validar(idParamSchema, 'params'), validarEditarReserva, reservasController.editarReserva);
router.patch('/:id/aprobar', verificarToken, soloAdmin, validar(idParamSchema, 'params'), reservasController.aprobarReserva);
router.patch('/:id/rechazar', verificarToken, soloAdmin, validar(idParamSchema, 'params'), reservasController.rechazarReserva);
router.patch('/:id/cancelar', verificarToken, validar(idParamSchema, 'params'), reservasController.cancelarReserva);

export default router;