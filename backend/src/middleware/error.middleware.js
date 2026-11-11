// src/middleware/error.middleware.js
import crypto from 'crypto';

export const sanitizarMensaje = (texto = '') => {
  if (typeof texto !== 'string') return '';
  return texto
    .replace(/(password|contrasena|contraseña|jwt_secret|secret|token)\s*[:=]\s*['"]?[^'"\s,;]+['"]?/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}/g, '[REDACTED]');
};

export const manejadorErrores = (err, req, res, _next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const correlationId = req.id || req.headers?.['x-correlation-id'] || crypto.randomUUID();

  // 1. Logging seguro de errores (SEC-CFG-03)
  const mensajeLimpio = sanitizarMensaje(err.message || 'Error desconocido');
  if (isProduction) {
    // En producción: solo registrar correlationId y mensaje saneado; NUNCA err.stack ni req.body
    console.error(`[Error ${correlationId}] ${mensajeLimpio}`);
  } else if (process.env.NODE_ENV !== 'test') {
    // En desarrollo: registrar traza completa
    console.error(err.stack);
  }

  // 2. Manejo de payload que excede el límite permitido (SEC-CFG-02)
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({
      error: 'El cuerpo de la petición excede el tamaño máximo permitido'
    });
  }

  // 3. Mapeo de errores de constraints de Sequelize / PostgreSQL
  const pgCode = err.parent?.code || err.original?.code;

  if (err.name === 'SequelizeExclusionConstraintError' || pgCode === '23P01') {
    return res.status(400).json({
      error: 'El aula ya está reservada en ese horario'
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError' || pgCode === '23505') {
    const constraint = (err.parent?.constraint || err.original?.constraint || '').toLowerCase();
    const esEmail =
      Boolean(err.fields?.email) ||
      constraint.includes('email') ||
      (Array.isArray(err.errors) && err.errors.some((e) => e.path === 'email'));

    const esAulaNombre =
      constraint.includes('aulas_nombre') ||
      (Array.isArray(err.errors) && err.errors.some((e) => e.path === 'nombre'));

    if (esAulaNombre) {
      return res.status(409).json({
        error: 'Ya existe un aula con ese nombre'
      });
    }

    return res.status(400).json({
      error: esEmail ? 'El email ya está registrado' : 'Ya existe un registro con esos datos únicos'
    });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError' || pgCode === '23503') {
    const constraint = (err.parent?.constraint || err.original?.constraint || err.index || '').toLowerCase();
    const detail = (err.parent?.detail || err.original?.detail || '').toLowerCase();
    const fields = Array.isArray(err.fields) ? err.fields.join(',').toLowerCase() : '';

    if (constraint.includes('aula') || detail.includes('aulas') || fields.includes('aulaid')) {
      return res.status(404).json({
        error: 'El aula solicitada no existe'
      });
    }

    if (constraint.includes('usuario') || detail.includes('usuarios') || fields.includes('usuarioid')) {
      return res.status(400).json({
        error: 'El usuario indicado no existe'
      });
    }

    return res.status(400).json({
      error: 'Referencia a un recurso inexistente'
    });
  }

  // 4. Código de estado HTTP
  const statusCode = err.status || err.statusCode || 500;

  // 5. Respuesta al cliente
  if (statusCode >= 500) {
    if (isProduction) {
      return res.status(500).json({
        error: 'Error interno del servidor',
        correlationId
      });
    }
    return res.status(500).json({
      error: err.message || 'Error interno del servidor',
      correlationId
    });
  }

  const payload = {
    error: err.message || 'Error en la petición'
  };
  if (err.reservasAfectadas !== undefined) payload.reservasAfectadas = err.reservasAfectadas;
  if (err.detalle !== undefined) payload.detalle = err.detalle;
  if (err.capacidadMaximaRequerida !== undefined) payload.capacidadMaximaRequerida = err.capacidadMaximaRequerida;

  return res.status(statusCode).json(payload);
};
