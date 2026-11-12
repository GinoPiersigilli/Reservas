import express from 'express';
import * as reservasController from '../controllers/reservas.controller.js';
import { validarCrearReserva, validarEditarReserva, validar, idParamSchema, queryReservasSchema } from '../middleware/validacion.middleware.js';
import { verificarToken, soloAdmin } from '../middleware/auth.middleware.js';
import { limiteEscrituras } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

router.get('/resumen', verificarToken, soloAdmin, reservasController.obtenerResumen);
router.get('/', verificarToken, validar(queryReservasSchema, 'query'), reservasController.listarReservas);

router.post('/', limiteEscrituras, verificarToken, validarCrearReserva, reservasController.crearReserva);
router.get('/:id', verificarToken, validar(idParamSchema, 'params'), reservasController.obtenerReservaPorId);
router.get('/:id/historial', verificarToken, validar(idParamSchema, 'params'), reservasController.obtenerHistorialDeReserva);

router.put('/:id', limiteEscrituras, verificarToken, soloAdmin, validar(idParamSchema, 'params'), validarEditarReserva, reservasController.editarReserva);
router.patch('/:id/aprobar', limiteEscrituras, verificarToken, soloAdmin, validar(idParamSchema, 'params'), reservasController.aprobarReserva);
router.patch('/:id/rechazar', limiteEscrituras, verificarToken, soloAdmin, validar(idParamSchema, 'params'), reservasController.rechazarReserva);
router.patch('/:id/cancelar', limiteEscrituras, verificarToken, validar(idParamSchema, 'params'), reservasController.cancelarReserva);

export default router;