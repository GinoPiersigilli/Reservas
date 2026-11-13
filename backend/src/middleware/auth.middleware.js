import jwt from 'jsonwebtoken';
import { createClerkClient, verifyToken } from '@clerk/backend';
import env from '../config/env.js';
import Usuario from '../models/usuario.model.js';
import logger from '../utils/logger.js';

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY
});

const SUFIJO_PLACEHOLDER = '@placeholder.clerk.local';

/** Datos del usuario de Clerk que se reflejan en la tabla local. */
const extraerDatosClerk = (clerkUser) => {
  const emailPrincipal =
    clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId) ||
    clerkUser.emailAddresses?.[0];

  const email =
    emailPrincipal?.emailAddress || `${clerkUser.id.toLowerCase()}${SUFIJO_PLACEHOLDER}`;
  const nombreCompleto = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();

  return {
    clerkId: clerkUser.id,
    emailPrincipal,
    email,
    nombre: nombreCompleto || clerkUser.username || email,
    rol: clerkUser.publicMetadata?.rol === 'admin' ? 'admin' : 'usuario',
    rolExplicito: Boolean(clerkUser.publicMetadata?.rol)
  };
};

/** Completa los datos provisorios de un usuario ya vinculado a Clerk. */
const actualizarUsuarioVinculado = async (usuarioLocal, datos) => {
  let cambiado = false;

  if (usuarioLocal.email.endsWith(SUFIJO_PLACEHOLDER) && datos.email !== usuarioLocal.email) {
    const emailOcupado = await Usuario.findOne({ where: { email: datos.email } });
    if (!emailOcupado) {
      usuarioLocal.email = datos.email;
      cambiado = true;
    }
  }
  if (usuarioLocal.nombre.includes('[PLACEHOLDER') && datos.nombre) {
    usuarioLocal.nombre = datos.nombre;
    cambiado = true;
  }
  if (datos.rolExplicito && usuarioLocal.rol !== datos.rol) {
    usuarioLocal.rol = datos.rol;
    cambiado = true;
  }
  if (cambiado) {
    await usuarioLocal.save();
  }

  return usuarioLocal;
};

/**
 * SEC-AUTH-05: solo se vincula o se crea una cuenta por email cuando Clerk
 * informa que ese correo está verificado.
 */
const exigirEmailVerificado = (datos) => {
  if (datos.emailPrincipal?.verification?.status === 'verified') return;

  const error = new Error('El correo electrónico principal de Clerk no está verificado');
  error.status = 403;
  throw error;
};

export async function sincronizarUsuarioClerk(clerkUser) {
  const datos = extraerDatosClerk(clerkUser);

  // 1. Buscar primero por clerkId (ej. usuario migrado con placeholder o ya vinculado)
  const yaVinculado = await Usuario.findOne({ where: { clerkId: datos.clerkId } });
  if (yaVinculado) {
    return actualizarUsuarioVinculado(yaVinculado, datos);
  }

  exigirEmailVerificado(datos);

  // 2. Si no existe por clerkId, buscar por email para vincular cuenta existente
  const mismoEmail = await Usuario.findOne({ where: { email: datos.email } });
  if (mismoEmail) {
    mismoEmail.clerkId = datos.clerkId;
    if (datos.rolExplicito && mismoEmail.rol !== datos.rol) {
      mismoEmail.rol = datos.rol;
    }
    await mismoEmail.save();
    logger.info('cuenta local vinculada a cuenta de Clerk', { usuarioId: mismoEmail.id });
    return mismoEmail;
  }

  // 3. Crear nuevo usuario local (just-in-time provisioning)
  return Usuario.create({
    nombre: datos.nombre,
    email: datos.email,
    passwordHash: null,
    clerkId: datos.clerkId,
    rol: datos.rol,
    activo: true
  });
}

export const verificarToken = async (req, res, next) => {
  const authorization = req.get('authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Token no informado' });
  }

  const token = authorization.substring(7);

  // Intentar con JWT local primero (usuarios de prueba)
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'reservas-api'
    });
  } catch {
    // Si jwt.verify falla (token de Clerk, expirado, firma inválida), se intenta con Clerk
  }

  if (payload) {
    try {
      const usuarioLocal = await Usuario.findByPk(payload.id);
      if (!usuarioLocal || !usuarioLocal.activo) {
        return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
      }

      req.usuario = {
        id: usuarioLocal.id,
        nombre: usuarioLocal.nombre,
        email: usuarioLocal.email,
        rol: usuarioLocal.rol
      };
      return next();
    } catch (dbError) {
      return next(dbError);
    }
  }

  // Intentar con Clerk verificando firma real y vinculando/creando usuario local en BD
  try {
    const verified = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      authorizedParties: env.CORS_ORIGINS
    });
    const clerkUser = await clerkClient.users.getUser(verified.sub);
    const usuarioLocal = await sincronizarUsuarioClerk(clerkUser);

    if (!usuarioLocal.activo) {
      return res.status(403).json({ error: 'Usuario inactivo' });
    }

    req.usuario = {
      id: usuarioLocal.id,
      clerkId: usuarioLocal.clerkId,
      nombre: usuarioLocal.nombre,
      email: usuarioLocal.email,
      rol: usuarioLocal.rol
    };

    return next();
  } catch (err) {
    if (err && err.status === 403) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

export const soloAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin' });
  }
  next();
};
