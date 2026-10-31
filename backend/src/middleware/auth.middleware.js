import jwt from 'jsonwebtoken';
import { createClerkClient, verifyToken } from '@clerk/backend';
import env from '../config/env.js';

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY
});

export const verificarToken = async (req, res, next) => {
  const authorization = req.get('authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Token no informado' });
  }

  const token = authorization.substring(7);

  // Intentar con JWT local primero (usuarios de prueba)
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.usuario = {
      id:     payload.id,
      nombre: payload.nombre,
      email:  payload.email,
      rol:    payload.rol
    };
    return next();
  } catch {}

  // Intentar con Clerk verificando firma real
  try {
    const verified = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY
    });
    const clerkUser = await clerkClient.users.getUser(verified.sub);

    req.usuario = {
      id:     clerkUser.id,
      nombre: clerkUser.firstName || clerkUser.username || clerkUser.emailAddresses[0]?.emailAddress,
      email:  clerkUser.emailAddresses[0]?.emailAddress,
      rol:    clerkUser.publicMetadata?.rol || 'usuario'
    };

    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

export const soloAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin' });
  }
  next();
};
