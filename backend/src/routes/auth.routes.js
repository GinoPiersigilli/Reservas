import express from 'express';
import rateLimit from 'express-rate-limit';
import { loginUsuario } from '../services/auth.services.js';
import { validarLogin } from '../middleware/validacion.middleware.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión, intente más tarde' }
});

router.post('/login', loginLimiter, validarLogin, async (req, res, next) => {
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
