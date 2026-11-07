// src/routes/aulas.routes.js
import express from 'express';
import { listarAulas, obtenerDisponibilidadAula } from '../controllers/aulas.controllers.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', listarAulas);
router.get('/:id/disponibilidad', verificarToken, obtenerDisponibilidadAula);

export default router;
