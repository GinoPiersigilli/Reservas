import dotenv from 'dotenv';

if (!globalThis.__DOTENV_LOADED__) {
  dotenv.config();
  globalThis.__DOTENV_LOADED__ = true;
}

export const validarEnv = (rawEnv = process.env) => {
  const nodeEnv = rawEnv.NODE_ENV || 'development';
  const obligatorias = nodeEnv === 'production'
    ? ['JWT_SECRET', 'CLERK_SECRET_KEY']
    : ['JWT_SECRET'];

  const faltantes = obligatorias.filter(
    (key) => !rawEnv[key] || !String(rawEnv[key]).trim()
  );

  if (faltantes.length > 0) {
    throw new Error(
      `Error de configuración (${nodeEnv}): faltan variables de entorno obligatorias: ${faltantes.join(', ')}`
    );
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: Number(rawEnv.PORT) || 3001,
    JWT_SECRET: String(rawEnv.JWT_SECRET).trim(),
    CLERK_SECRET_KEY: rawEnv.CLERK_SECRET_KEY ? String(rawEnv.CLERK_SECRET_KEY).trim() : '',
    WORK_HOUR_START: rawEnv.WORK_HOUR_START || '08:00',
    WORK_HOUR_END: rawEnv.WORK_HOUR_END || '22:00',
    CORS_ORIGINS: (rawEnv.CORS_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
};

export const env = validarEnv(process.env);
export default env;
