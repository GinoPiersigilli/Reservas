import express from 'express';
import { loginUsuario, registrarUsuario } from '../services/auth.services.js';
import { validarLogin, validarRegistro } from '../middleware/validacion.middleware.js';

const router = express.Router();

router.post('/register', validarRegistro, async (req, res, next) => {
  try {
    const usuario = await registrarUsuario(req.body);
    res.status(201).json(usuario);
  } catch (error) {
    error.status = 400;
    next(error);
  }
});

router.post('/login', validarLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const resultado = await loginUsuario(email, password);
    res.status(200).json(resultado);
  } catch (error) {
    error.status = 401;
    next(error);
  }
});

export default router;

