import jwt from 'jsonwebtoken';
import { createClerkClient, verifyToken } from '@clerk/backend';
import env from '../config/env.js';
import Usuario from '../models/usuario.model.js';

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY
});

export async function sincronizarUsuarioClerk(clerkUser) {
  const clerkId = clerkUser.id;
  const emailClerk = clerkUser.emailAddresses?.[0]?.emailAddress || `${clerkId.toLowerCase()}@placeholder.clerk.local`;
  const nombreCompleto = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();
  const nombreClerk = nombreCompleto || clerkUser.username || emailClerk;
  const rolClerk = clerkUser.publicMetadata?.rol === 'admin' ? 'admin' : 'usuario';

  // 1. Buscar primero por clerkId (ej. usuario migrado con placeholder o ya vinculado)
  let usuarioLocal = await Usuario.findOne({ where: { clerkId } });

  if (usuarioLocal) {
    let cambiado = false;
    if (usuarioLocal.email.endsWith('@placeholder.clerk.local') && emailClerk !== usuarioLocal.email) {
      const emailOcupado = await Usuario.findOne({ where: { email: emailClerk } });
      if (!emailOcupado) {
        usuarioLocal.email = emailClerk;
        cambiado = true;
      }
    }
    if (usuarioLocal.nombre.includes('[PLACEHOLDER') && nombreClerk) {
      usuarioLocal.nombre = nombreClerk;
      cambiado = true;
    }
    if (clerkUser.publicMetadata?.rol && usuarioLocal.rol !== rolClerk) {
      usuarioLocal.rol = rolClerk;
      cambiado = true;
    }
    if (cambiado) {
      await usuarioLocal.save();
    }
    return usuarioLocal;
  }

  // 2. Si no existe por clerkId, buscar por email para vincular cuenta existente
  usuarioLocal = await Usuario.findOne({ where: { email: emailClerk } });
  if (usuarioLocal) {
    usuarioLocal.clerkId = clerkId;
    if (clerkUser.publicMetadata?.rol && usuarioLocal.rol !== rolClerk) {
      usuarioLocal.rol = rolClerk;
    }
    await usuarioLocal.save();
    return usuarioLocal;
  }

  // 3. Crear nuevo usuario local (just-in-time provisioning)
  usuarioLocal = await Usuario.create({
    nombre:       nombreClerk,
    email:        emailClerk,
    passwordHash: null,
    clerkId,
    rol:          rolClerk,
    activo:       true
  });

  return usuarioLocal;
}

export const verificarToken = async (req, res, next) => {
  const authorization = req.get('authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Token no informado' });
  }

  const token = authorization.substring(7);

  // Intentar con JWT local primero (usuarios de prueba)
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'reservas-api'
    });

    const usuarioLocal = await Usuario.findByPk(payload.id);
    if (!usuarioLocal || !usuarioLocal.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    req.usuario = {
      id:     usuarioLocal.id,
      nombre: usuarioLocal.nombre,
      email:  usuarioLocal.email,
      rol:    usuarioLocal.rol
    };
    return next();
  } catch {}

  // Intentar con Clerk verificando firma real y vinculando/creando usuario local en BD
  try {
    const verified = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY
    });
    const clerkUser = await clerkClient.users.getUser(verified.sub);
    const usuarioLocal = await sincronizarUsuarioClerk(clerkUser);

    if (!usuarioLocal.activo) {
      return res.status(403).json({ error: 'Usuario inactivo' });
    }

    req.usuario = {
      id:      usuarioLocal.id,
      clerkId: usuarioLocal.clerkId,
      nombre:  usuarioLocal.nombre,
      email:   usuarioLocal.email,
      rol:     usuarioLocal.rol
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
