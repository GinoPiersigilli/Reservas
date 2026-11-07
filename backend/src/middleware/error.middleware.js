// src/middleware/error.middleware.js

export const manejadorErrores = (err, req, res, next) => {
  // 1. Logueamos el error en la consola del servidor para desarrollo
  if (process.env.NODE_ENV !== 'test') {
    console.error(err.stack);
  }

  // 2. Mapeo de errores de constraints de Sequelize / PostgreSQL
  const pgCode = err.parent?.code || err.original?.code;

  if (err.name === 'SequelizeExclusionConstraintError' || pgCode === '23P01') {
    return res.status(400).json({
      error: 'El aula ya está reservada en ese horario'
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError' || pgCode === '23505') {
    const constraint = err.parent?.constraint || err.original?.constraint || '';
    const esEmail =
      Boolean(err.fields?.email) ||
      constraint.includes('email') ||
      (Array.isArray(err.errors) && err.errors.some((e) => e.path === 'email'));

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

  // 3. Extraemos el código de estado (por defecto 500 si no se especificó)
  const statusCode = err.status || 500;

  // 4. Extraemos el mensaje de error
  const mensaje = err.message || 'Error interno del servidor';

  // 5. Respondemos al cliente con el formato JSON claro que pide el enunciado
  res.status(statusCode).json({
    error: mensaje
  });
};
