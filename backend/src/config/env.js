import dotenv from 'dotenv';

if (!globalThis.__DOTENV_LOADED__) {
  dotenv.config();
  globalThis.__DOTENV_LOADED__ = true;
}

export const validarEnv = (rawEnv = process.env) => {
  const nodeEnv = rawEnv.NODE_ENV || 'development';
  const dbUrlKey = nodeEnv === 'test' ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
  const obligatorias = nodeEnv === 'production'
    ? ['JWT_SECRET', 'CLERK_SECRET_KEY', dbUrlKey]
    : ['JWT_SECRET', dbUrlKey];

  const faltantes = obligatorias.filter(
    (key) => !rawEnv[key] || !String(rawEnv[key]).trim()
  );

  if (faltantes.length > 0) {
    throw new Error(
      `Error de configuración (${nodeEnv}): faltan variables de entorno obligatorias: ${faltantes.join(', ')}`
    );
  }

  const defaultTrustProxyHops = nodeEnv === 'production' ? 1 : 0;
  const trustProxyHops = rawEnv.TRUST_PROXY_HOPS !== undefined && String(rawEnv.TRUST_PROXY_HOPS).trim() !== ''
    ? Number(rawEnv.TRUST_PROXY_HOPS)
    : defaultTrustProxyHops;

  return {
    NODE_ENV: nodeEnv,
    PORT: Number(rawEnv.PORT) || 3001,
    TRUST_PROXY_HOPS: Number.isFinite(trustProxyHops) ? trustProxyHops : defaultTrustProxyHops,
    JWT_SECRET: String(rawEnv.JWT_SECRET).trim(),
    CLERK_SECRET_KEY: rawEnv.CLERK_SECRET_KEY ? String(rawEnv.CLERK_SECRET_KEY).trim() : '',
    DATABASE_URL: rawEnv.DATABASE_URL ? String(rawEnv.DATABASE_URL).trim() : '',
    DATABASE_URL_TEST: rawEnv.DATABASE_URL_TEST ? String(rawEnv.DATABASE_URL_TEST).trim() : '',
    LOG_SQL: String(rawEnv.LOG_SQL).toLowerCase() === 'true',
    WORK_HOUR_START: rawEnv.WORK_HOUR_START || '08:00',
    WORK_HOUR_END: rawEnv.WORK_HOUR_END || '22:00',
    RATE_LIMIT_GENERAL_WINDOW_MS: Number(rawEnv.RATE_LIMIT_GENERAL_WINDOW_MS) || 15 * 60 * 1000,
    RATE_LIMIT_GENERAL_MAX: rawEnv.RATE_LIMIT_GENERAL_MAX !== undefined && String(rawEnv.RATE_LIMIT_GENERAL_MAX).trim() !== ''
      ? Number(rawEnv.RATE_LIMIT_GENERAL_MAX)
      : (nodeEnv === 'test' ? 10000 : 300),
    RATE_LIMIT_ESCRITURAS_WINDOW_MS: Number(rawEnv.RATE_LIMIT_ESCRITURAS_WINDOW_MS) || 15 * 60 * 1000,
    RATE_LIMIT_ESCRITURAS_MAX: rawEnv.RATE_LIMIT_ESCRITURAS_MAX !== undefined && String(rawEnv.RATE_LIMIT_ESCRITURAS_MAX).trim() !== ''
      ? Number(rawEnv.RATE_LIMIT_ESCRITURAS_MAX)
      : (nodeEnv === 'test' ? 10000 : 60),
    RATE_LIMIT_USUARIO_WINDOW_MS: Number(rawEnv.RATE_LIMIT_USUARIO_WINDOW_MS) || 15 * 60 * 1000,
    RATE_LIMIT_USUARIO_MAX: rawEnv.RATE_LIMIT_USUARIO_MAX !== undefined && String(rawEnv.RATE_LIMIT_USUARIO_MAX).trim() !== ''
      ? Number(rawEnv.RATE_LIMIT_USUARIO_MAX)
      : (nodeEnv === 'test' ? 10000 : 60),
    DB_POOL_MAX: Number(rawEnv.DB_POOL_MAX) || (nodeEnv === 'test' ? 30 : 20),
    DB_POOL_MIN: rawEnv.DB_POOL_MIN !== undefined && String(rawEnv.DB_POOL_MIN).trim() !== ''
      ? Number(rawEnv.DB_POOL_MIN)
      : (nodeEnv === 'test' ? 0 : 2),
    DB_POOL_ACQUIRE: Number(rawEnv.DB_POOL_ACQUIRE) || 30000,
    DB_POOL_IDLE: Number(rawEnv.DB_POOL_IDLE) || 10000,
    CORS_ORIGINS: (rawEnv.CORS_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
};

export const env = validarEnv(process.env);
export default env;
