// src/utils/sanitizar.js

/**
 * Oculta secretos en textos antes de registrarlos (hallazgo SEC-CFG-03).
 *
 * Cubre tres formas en las que un secreto termina en un log: pares
 * `clave=valor`, cabeceras `Authorization: Bearer …` y tokens JWT sueltos.
 */
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

export default sanitizarMensaje;
