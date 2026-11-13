import dotenv from 'dotenv';

if (!globalThis.__DOTENV_LOADED__) {
  dotenv.config();
  globalThis.__DOTENV_LOADED__ = true;
}

const estaDefinida = (valor) => valor !== undefined && String(valor).trim() !== '';

/** Entero tomado del entorno; si falta o no es válido, se usa el valor por defecto. */
const leerEntero = (valor, porDefecto) => {
  if (!estaDefinida(valor)) return porDefecto;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : porDefecto;
};

/** Texto del entorno sin espacios alrededor. */
const leerTexto = (valor, porDefecto = '') =>
  estaDefinida(valor) ? String(valor).trim() : porDefecto;

const NIVELES_LOG = ['debug', 'info', 'warn', 'error', 'silent'];

/** Nivel de registro; en pruebas se silencia salvo que se pida explícitamente. */
const leerNivelLog = (valor, esTest) =>
  NIVELES_LOG.includes(valor) ? valor : esTest ? 'silent' : 'info';

/** Verifica que estén presentes las variables sin las que la API no puede arrancar. */
const verificarObligatorias = (rawEnv, nodeEnv, dbUrlKey) => {
  const obligatorias =
    nodeEnv === 'production'
      ? ['JWT_SECRET', 'CLERK_SECRET_KEY', dbUrlKey]
      : ['JWT_SECRET', dbUrlKey];

  const faltantes = obligatorias.filter((key) => !estaDefinida(rawEnv[key]));

  if (faltantes.length > 0) {
    throw new Error(
      `Error de configuración (${nodeEnv}): faltan variables de entorno obligatorias: ${faltantes.join(', ')}`
    );
  }
};

export const validarEnv = (rawEnv = process.env) => {
  const nodeEnv = rawEnv.NODE_ENV || 'development';
  const esTest = nodeEnv === 'test';
  const dbUrlKey = esTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL';

  verificarObligatorias(rawEnv, nodeEnv, dbUrlKey);

  const QUINCE_MINUTOS = 15 * 60 * 1000;
  // En pruebas los límites por IP se elevan para no interferir entre casos.
  const maxEscriturasPorDefecto = esTest ? 10000 : 60;

  return {
    NODE_ENV: nodeEnv,
    PORT: leerEntero(rawEnv.PORT, 3001),
    TRUST_PROXY_HOPS: leerEntero(rawEnv.TRUST_PROXY_HOPS, nodeEnv === 'production' ? 1 : 0),
    JWT_SECRET: leerTexto(rawEnv.JWT_SECRET),
    CLERK_SECRET_KEY: leerTexto(rawEnv.CLERK_SECRET_KEY),
    DATABASE_URL: leerTexto(rawEnv.DATABASE_URL),
    DATABASE_URL_TEST: leerTexto(rawEnv.DATABASE_URL_TEST),
    LOG_SQL: String(rawEnv.LOG_SQL).toLowerCase() === 'true',
    LOG_LEVEL: leerNivelLog(rawEnv.LOG_LEVEL, esTest),
    SLOW_QUERY_MS: leerEntero(rawEnv.SLOW_QUERY_MS, 300),
    WORK_HOUR_START: rawEnv.WORK_HOUR_START || '08:00',
    WORK_HOUR_END: rawEnv.WORK_HOUR_END || '22:00',
    RATE_LIMIT_LOGIN_WINDOW_MS: leerEntero(rawEnv.RATE_LIMIT_LOGIN_WINDOW_MS, QUINCE_MINUTOS),
    RATE_LIMIT_LOGIN_MAX: leerEntero(rawEnv.RATE_LIMIT_LOGIN_MAX, 10),
    RATE_LIMIT_GENERAL_WINDOW_MS: leerEntero(rawEnv.RATE_LIMIT_GENERAL_WINDOW_MS, QUINCE_MINUTOS),
    RATE_LIMIT_GENERAL_MAX: leerEntero(rawEnv.RATE_LIMIT_GENERAL_MAX, esTest ? 10000 : 300),
    RATE_LIMIT_ESCRITURAS_WINDOW_MS: leerEntero(
      rawEnv.RATE_LIMIT_ESCRITURAS_WINDOW_MS,
      QUINCE_MINUTOS
    ),
    RATE_LIMIT_ESCRITURAS_MAX: leerEntero(
      rawEnv.RATE_LIMIT_ESCRITURAS_MAX,
      maxEscriturasPorDefecto
    ),
    RATE_LIMIT_USUARIO_WINDOW_MS: leerEntero(rawEnv.RATE_LIMIT_USUARIO_WINDOW_MS, QUINCE_MINUTOS),
    RATE_LIMIT_USUARIO_MAX: leerEntero(rawEnv.RATE_LIMIT_USUARIO_MAX, maxEscriturasPorDefecto),
    DB_POOL_MAX: leerEntero(rawEnv.DB_POOL_MAX, esTest ? 30 : 20),
    DB_POOL_MIN: leerEntero(rawEnv.DB_POOL_MIN, esTest ? 0 : 2),
    DB_POOL_ACQUIRE: leerEntero(rawEnv.DB_POOL_ACQUIRE, 30000),
    DB_POOL_IDLE: leerEntero(rawEnv.DB_POOL_IDLE, 10000),
    CORS_ORIGINS: (rawEnv.CORS_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
};

export const env = validarEnv(process.env);
export default env;
