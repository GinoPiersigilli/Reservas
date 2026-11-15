import express from 'express';
import { loginUsuario } from '../services/auth.services.js';
import { validar, loginSchema } from '../middleware/validacion.middleware.js';
import { limiteLogin } from '../middleware/rateLimit.middleware.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Quién es el portador de este token, según esta base de datos.
 *
 * Existe porque el frontend no puede deducirlo del token de Clerk. Ahí el
 * identificador es la cadena `user_2…` de Clerk y el rol vive en
 * `publicMetadata`, mientras que las reservas referencian la clave primaria
 * entera de `usuarios` y el rol que manda es el de esta base (ver ADR 0002).
 * Comparar una cosa con la otra no da error: da `false` siempre, que es peor.
 *
 * `req.usuario` ya lo armó `verificarToken` leyendo la fila real, así que acá
 * no hay más que devolverlo. Se eligen los campos de a uno para que agregar una
 * columna a la tabla no la publique sin querer.
 */
router.get('/me', verificarToken, (req, res) => {
  const { id, nombre, email, rol } = req.usuario;
  res.status(200).json({ id, nombre, email, rol });
});

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
