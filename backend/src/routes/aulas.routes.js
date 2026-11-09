// src/routes/aulas.routes.js
import express from 'express';
import { listarAulas, obtenerDisponibilidadAula } from '../controllers/aulas.controllers.js';
import { verificarToken } from '../middleware/auth.middleware.js';
import { validar, idParamSchema } from '../middleware/validacion.middleware.js';

const router = express.Router();

router.get('/', verificarToken, listarAulas);
router.get('/:id/disponibilidad', verificarToken, validar(idParamSchema, 'params'), obtenerDisponibilidadAula);

export default router;
