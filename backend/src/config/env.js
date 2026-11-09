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
    CORS_ORIGINS: (rawEnv.CORS_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
};

export const env = validarEnv(process.env);
export default env;
