// src/middleware/observabilidad.middleware.js
import crypto from 'crypto';
import logger from '../utils/logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Asigna un id a cada petición y lo deja disponible en `req.id`, en el logger
 * de la petición (`req.log`) y en la cabecera `X-Request-Id` de la respuesta.
 *
 * Si el cliente o un proxy envían un id propio se respeta, de modo que una
 * misma operación pueda seguirse de extremo a extremo, pero solo cuando es un
 * UUID: un valor arbitrario permitiría inyectar texto en los logs o inflarlos.
 */
export const asignarRequestId = (req, res, next) => {
  const recibido = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const id =
    typeof recibido === 'string' && UUID_REGEX.test(recibido) ? recibido : crypto.randomUUID();

  req.id = id;
  req.log = logger.hijo({ requestId: id });
  res.setHeader('X-Request-Id', id);

  next();
};

/**
 * Registra una línea por petición cuando termina la respuesta.
 *
 * Se guarda la ruta declarada (`/api/reservas/:id`) y no la dirección real,
 * para no volcar identificadores ni parámetros de consulta en los logs, y
 * agrupar por endpoint al analizarlos.
 */
export const registrarPeticiones = (req, res, next) => {
  const inicio = process.hrtime.bigint();

  res.on('finish', () => {
    const duracionMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    const ruta = req.route
      ? `${req.baseUrl}${req.route.path}`.replace(/\/$/, '')
      : req.baseUrl || req.path;

    const datos = {
      metodo: req.method,
      ruta,
      estado: res.statusCode,
      duracionMs: Math.round(duracionMs * 10) / 10,
      usuarioId: req.usuario?.id
    };

    const log = req.log || logger;
    if (res.statusCode >= 500) {
      log.error('peticion', datos);
    } else if (res.statusCode >= 400) {
      log.warn('peticion', datos);
    } else {
      log.info('peticion', datos);
    }
  });

  next();
};
