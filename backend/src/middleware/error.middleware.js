// src/middleware/error.middleware.js
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { sanitizarMensaje } from '../utils/sanitizar.js';

export { sanitizarMensaje };

const codigoPg = (err) => err.parent?.code || err.original?.code;

const textoConstraint = (err) =>
  (err.parent?.constraint || err.original?.constraint || err.index || '').toLowerCase();

const tienePath = (err, path) =>
  Array.isArray(err.errors) && err.errors.some((e) => e.path === path);

/**
 * Registra el error sin exponer secretos ni cuerpos de petición.
 *
 * En producción nunca se registra la traza: el id de correlación es lo que
 * permite unir el error que vio la persona con la línea del log.
 */
const registrarError = (err, req, correlationId, esProduccion) => {
  const log = req.log || logger.hijo({ requestId: correlationId });
  const status = err.status || err.statusCode || 500;
  const mensaje = sanitizarMensaje(err.message || 'Error desconocido');

  // Un 4xx es un pedido mal formado, no una falla del servidor: queda como
  // aviso y sin traza, para que los errores reales no se pierdan entre ellos.
  if (status < 500) {
    log.warn('peticion rechazada', { nombre: err.name, status, detalle: mensaje });
    return;
  }

  // Línea de texto además del JSON: es el formato que verifica la prueba de
  // SEC-CFG-03 y el que permite buscar un id concreto a simple vista.
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error ${correlationId}] ${mensaje}`);
  }

  log.error('error no controlado', {
    nombre: err.name,
    status,
    codigoPg: err.parent?.code || err.original?.code,
    detalle: mensaje,
    traza: esProduccion ? undefined : err.stack
  });
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

/**
 * Solapamiento de reservas garantizado por la restricción de exclusión.
 *
 * Responde 409 y no 400: el pedido está bien formado y es válido: lo que falla
 * es que choca con el estado actual del recurso, que es la definición de 409 en
 * la RFC 9110. Un 400 le diría a quien integra la API que revise el cuerpo del
 * pedido, cuando lo que tiene que hacer es elegir otra franja.
 */
const mapearSolapamiento = (err) => {
  if (err.name === 'SequelizeExclusionConstraintError' || codigoPg(err) === '23P01') {
    return { status: 409, cuerpo: { error: 'El aula ya está reservada en ese horario' } };
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

  // Mismo criterio que el solapamiento y que el nombre de aula repetido: los
  // tres son conflictos con el estado y los tres responden 409.
  return {
    status: 409,
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

  registrarError(err, req, correlationId, esProduccion);

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
