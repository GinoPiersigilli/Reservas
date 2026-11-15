import jwt from 'jsonwebtoken';
import { createClerkClient, verifyToken } from '@clerk/backend';
import env from '../config/env.js';
import Usuario from '../models/usuario.model.js';
import logger from '../utils/logger.js';

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY
});

const SUFIJO_PLACEHOLDER = '@placeholder.clerk.local';
const MARCA_NOMBRE_PLACEHOLDER = '[PLACEHOLDER';

/**
 * Si a esta fila todavía le faltan datos que solo Clerk puede dar.
 *
 * Las cuentas migradas del esquema viejo entraron con un correo y un nombre de
 * relleno; hasta completarlos hay que preguntarle a Clerk. Una vez completos,
 * la fila local alcanza y la consulta por red deja de hacer falta.
 */
const tieneDatosProvisorios = (usuarioLocal) =>
  usuarioLocal.email.endsWith(SUFIJO_PLACEHOLDER) ||
  usuarioLocal.nombre.includes(MARCA_NOMBRE_PLACEHOLDER);

/** Sequelize y PostgreSQL nombran distinto la misma violación de unicidad. */
const esViolacionDeUnicidad = (error) =>
  error?.name === 'SequelizeUniqueConstraintError' ||
  error?.parent?.code === '23505' ||
  error?.original?.code === '23505';

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
  if (usuarioLocal.nombre.includes(MARCA_NOMBRE_PLACEHOLDER) && datos.nombre) {
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

async function vincularOCrearUsuario(clerkUser) {
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

/**
 * Da de alta o vincula la cuenta local de quien llega con un token de Clerk.
 *
 * El primer ingreso dispara varias peticiones a la vez —la pantalla pide aulas
 * y reservas en paralelo— y todas encuentran la fila inexistente y la intentan
 * crear. Una gana y las demás chocan contra la restricción de unicidad. Antes
 * ese choque salía como «token inválido» y deslogueaba a quien acababa de
 * entrar; ahora se relee la fila que creó la que ganó, que es lo que se quería
 * desde el principio.
 */
export async function sincronizarUsuarioClerk(clerkUser) {
  try {
    return await vincularOCrearUsuario(clerkUser);
  } catch (error) {
    if (!esViolacionDeUnicidad(error)) throw error;

    const creadoPorOtra = await Usuario.findOne({ where: { clerkId: clerkUser.id } });
    if (creadoPorOtra) return creadoPorOtra;

    throw error;
  }
}

/**
 * La cuenta local de un token de Clerk, preguntándole a Clerk lo menos posible.
 *
 * Antes cada petición llamaba a `clerkClient.users.getUser` antes de mirar la
 * base, lo que sumaba una ida y vuelta por red a cada `GET` y gastaba cupo de
 * la API de Clerk sin necesidad. La fila local ya tiene todo lo que hace falta
 * para armar `req.usuario`, así que solo se consulta a Clerk cuando esa fila no
 * existe todavía o le faltan datos.
 *
 * Consecuencia a tener presente: un cambio de `publicMetadata.rol` en Clerk ya
 * no se refleja solo en la petición siguiente. Es coherente con el ADR 0002
 * —el rol efectivo es el de esta base— y ese metadato queda como lo que
 * siempre debió ser: el rol con el que nace la cuenta, no su fuente de verdad.
 */
const resolverUsuarioDeClerk = async (clerkId) => {
  const yaVinculado = await Usuario.findOne({ where: { clerkId } });
  if (yaVinculado && !tieneDatosProvisorios(yaVinculado)) return yaVinculado;

  const clerkUser = await clerkClient.users.getUser(clerkId);
  return sincronizarUsuarioClerk(clerkUser);
};

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
    const usuarioLocal = await resolverUsuarioDeClerk(verified.sub);

    // 401 y no 403, igual que la vía del token local: las dos describen la
    // misma situación, y el interceptor del frontend limpia la sesión con 401.
    if (!usuarioLocal.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
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
