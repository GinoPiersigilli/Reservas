// src/routes/aulas.routes.js
import express from 'express';
import {
  listarAulas,
  obtenerDisponibilidadAula,
  crearAula,
  editarAula,
  desactivarAula,
  reactivarAula
} from '../controllers/aulas.controllers.js';
import { verificarToken, soloAdmin } from '../middleware/auth.middleware.js';
import {
  validar,
  idParamSchema,
  queryAulasSchema,
  crearAulaSchema,
  editarAulaSchema,
  desactivarAulaSchema
} from '../middleware/validacion.middleware.js';

const router = express.Router();

router.get('/', verificarToken, validar(queryAulasSchema, 'query'), listarAulas);
router.get('/:id/disponibilidad', verificarToken, validar(idParamSchema, 'params'), obtenerDisponibilidadAula);

router.post('/', verificarToken, soloAdmin, validar(crearAulaSchema, 'body'), crearAula);
router.put('/:id', verificarToken, soloAdmin, validar(idParamSchema, 'params'), validar(editarAulaSchema, 'body'), editarAula);
router.patch('/:id/desactivar', verificarToken, soloAdmin, validar(idParamSchema, 'params'), validar(desactivarAulaSchema, 'body'), desactivarAula);
router.patch('/:id/reactivar', verificarToken, soloAdmin, validar(idParamSchema, 'params'), reactivarAula);

export default router;
