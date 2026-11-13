import express from 'express';
import { loginUsuario } from '../services/auth.services.js';
import { validar, loginSchema } from '../middleware/validacion.middleware.js';
import { limiteLogin } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

router.post('/login', limiteLogin, validar(loginSchema), async (req, res, next) => {
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
