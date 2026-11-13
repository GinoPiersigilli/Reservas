// src/middleware/error.middleware.js
import crypto from 'crypto';

export const sanitizarMensaje = (texto = '') => {
  if (typeof texto !== 'string') return '';
  return texto
    .replace(
      /(password|contrasena|contraseña|jwt_secret|secret|token)\s*[:=]\s*['"]?[^'"\s,;]+['"]?/gi,
      '$1=[REDACTED]'
    )
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}/g, '[REDACTED]');
};

const codigoPg = (err) => err.parent?.code || err.original?.code;

const textoConstraint = (err) =>
  (err.parent?.constraint || err.original?.constraint || err.index || '').toLowerCase();

const tienePath = (err, path) =>
  Array.isArray(err.errors) && err.errors.some((e) => e.path === path);

/** Registra el error sin exponer secretos ni cuerpos de petición. */
const registrarError = (err, correlationId, esProduccion) => {
  if (esProduccion) {
    // En producción: solo correlationId y mensaje saneado; NUNCA err.stack ni req.body
    console.error(
      `[Error ${correlationId}] ${sanitizarMensaje(err.message || 'Error desconocido')}`
    );
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error(err.stack);
  }
};

/** Cuerpo de la petición por encima del límite permitido (SEC-CFG-02). */
const mapearPayloadExcedido = (err) => {
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return {
      status: 413,
      cuerpo: { error: 'El cuerpo de la petición excede el tamaño máximo permitido' }
    };
  }
  return null;
};

/** Saturación del pool de conexiones: 503 con Retry-After en lugar de 500. */
const mapearPoolSaturado = (err) => {
  const esTimeoutDePool =
    err.name === 'SequelizeConnectionAcquireTimeoutError' ||
    err.name === 'ConnectionAcquireTimeoutError' ||
    err.name === 'TimeoutError' ||
    (typeof err.message === 'string' &&
      /ResourceRequest timed out|Connection acquire timeout/i.test(err.message));

  if (!esTimeoutDePool) return null;

  return {
    status: 503,
    cabeceras: { 'Retry-After': '2' },
    cuerpo: { error: 'El servidor se encuentra temporalmente sobrecargado, intente más tarde' }
  };
};

/** Solapamiento de reservas garantizado por la restricción de exclusión. */
const mapearSolapamiento = (err) => {
  if (err.name === 'SequelizeExclusionConstraintError' || codigoPg(err) === '23P01') {
    return { status: 400, cuerpo: { error: 'El aula ya está reservada en ese horario' } };
  }
  return null;
};

/** Violaciones de unicidad: email de usuario o nombre de aula. */
const mapearUnicidad = (err) => {
  if (err.name !== 'SequelizeUniqueConstraintError' && codigoPg(err) !== '23505') return null;

  const constraint = textoConstraint(err);

  if (constraint.includes('aulas_nombre') || tienePath(err, 'nombre')) {
    return { status: 409, cuerpo: { error: 'Ya existe un aula con ese nombre' } };
  }

  const esEmail =
    Boolean(err.fields?.email) || constraint.includes('email') || tienePath(err, 'email');

  return {
    status: 400,
    cuerpo: {
      error: esEmail ? 'El email ya está registrado' : 'Ya existe un registro con esos datos únicos'
    }
  };
};

/** Violaciones de integridad referencial: aula o usuario inexistente. */
const mapearClaveForanea = (err) => {
  if (err.name !== 'SequelizeForeignKeyConstraintError' && codigoPg(err) !== '23503') return null;

  const constraint = textoConstraint(err);
  const detalle = (err.parent?.detail || err.original?.detail || '').toLowerCase();
  const campos = Array.isArray(err.fields) ? err.fields.join(',').toLowerCase() : '';
  const menciona = (aguja, alternativa, campo) =>
    constraint.includes(aguja) || detalle.includes(alternativa) || campos.includes(campo);

  if (menciona('aula', 'aulas', 'aulaid')) {
    return { status: 404, cuerpo: { error: 'El aula solicitada no existe' } };
  }
  if (menciona('usuario', 'usuarios', 'usuarioid')) {
    return { status: 400, cuerpo: { error: 'El usuario indicado no existe' } };
  }
  return { status: 400, cuerpo: { error: 'Referencia a un recurso inexistente' } };
};

const MAPEADORES = [
  mapearPayloadExcedido,
  mapearPoolSaturado,
  mapearSolapamiento,
  mapearUnicidad,
  mapearClaveForanea
];

/** Errores internos: en producción nunca se filtra el mensaje original. */
const respuestaErrorInterno = (err, correlationId, esProduccion) => ({
  status: 500,
  cuerpo: {
    error: esProduccion
      ? 'Error interno del servidor'
      : err.message || 'Error interno del servidor',
    correlationId
  }
});

/** Errores de negocio (4xx): se conservan los datos extra que aporte el servicio. */
const respuestaErrorCliente = (err, statusCode) => {
  const cuerpo = { error: err.message || 'Error en la petición' };
  if (err.reservasAfectadas !== undefined) cuerpo.reservasAfectadas = err.reservasAfectadas;
  if (err.detalle !== undefined) cuerpo.detalle = err.detalle;
  if (err.capacidadMaximaRequerida !== undefined) {
    cuerpo.capacidadMaximaRequerida = err.capacidadMaximaRequerida;
  }
  return { status: statusCode, cuerpo };
};

export const manejadorErrores = (err, req, res, _next) => {
  const esProduccion = process.env.NODE_ENV === 'production';
  const correlationId = req.id || req.headers?.['x-correlation-id'] || crypto.randomUUID();

  registrarError(err, correlationId, esProduccion);

  let respuesta = null;
  for (const mapear of MAPEADORES) {
    respuesta = mapear(err);
    if (respuesta) break;
  }

  if (!respuesta) {
    const statusCode = err.status || err.statusCode || 500;
    respuesta =
      statusCode >= 500
        ? respuestaErrorInterno(err, correlationId, esProduccion)
        : respuestaErrorCliente(err, statusCode);
  }

  for (const [nombre, valor] of Object.entries(respuesta.cabeceras || {})) {
    res.setHeader(nombre, valor);
  }

  return res.status(respuesta.status).json(respuesta.cuerpo);
};
