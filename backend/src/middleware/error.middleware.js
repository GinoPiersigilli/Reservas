// src/middleware/error.middleware.js

export const manejadorErrores = (err, req, res, next) => {
  // 1. Logueamos el error en la consola del servidor para desarrollo
  console.error(err.stack);

  // 2. Extraemos el código de estado (por defecto 500 si no se especificó)
  const statusCode = err.status || 500;
  
  // 3. Extraemos el mensaje de error
  const mensaje = err.message || 'Error interno del servidor';

  // 4. Respondemos al cliente con el formato JSON claro que pide el enunciado
  res.status(statusCode).json({ 
    error: mensaje 
  });
};