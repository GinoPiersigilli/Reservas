// src/routes/aulas.routes.js
import express from 'express';
import { listarAulas } from '../controllers/aulas.controllers.js';

const router = express.Router();

router.get('/', listarAulas);

export default router;