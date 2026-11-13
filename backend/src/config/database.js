// src/config/database.js
import { Sequelize } from 'sequelize';
import env from './env.js';
import logger from '../utils/logger.js';

const databaseUrl = env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL;

/**
 * Deja la consulta en una sola línea y sin los valores enlazados: alcanza para
 * identificar qué consulta se degradó, sin volcar datos de usuarios al log.
 */
const resumirSql = (sql) => sql.replace(/\s+/g, ' ').trim().slice(0, 300);

/**
 * Registro de consultas lentas.
 *
 * Con `benchmark: true`, Sequelize pasa la duración de cada consulta. Solo se
 * registran las que superan SLOW_QUERY_MS, de modo que el log sirva para
 * detectar una consulta que se degrada sin inundarlo con el tráfico normal.
 * `LOG_SQL=true` registra todas en nivel debug, para depurar en desarrollo.
 */
const registrarConsulta = (sql, duracionMs) => {
  if (env.LOG_SQL) {
    logger.debug('consulta sql', { sql: resumirSql(sql), duracionMs });
    return;
  }

  if (typeof duracionMs === 'number' && duracionMs >= env.SLOW_QUERY_MS) {
    logger.warn('consulta lenta', {
      sql: resumirSql(sql),
      duracionMs,
      umbralMs: env.SLOW_QUERY_MS
    });
  }
};

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  benchmark: true,
  // Qué se ve lo decide LOG_LEVEL (en pruebas, 'silent'), no el entorno: así el
  // mismo mecanismo sirve en desarrollo, en producción y en las pruebas.
  logging: registrarConsulta,
  pool: {
    max: env.DB_POOL_MAX,
    min: env.DB_POOL_MIN,
    acquire: env.DB_POOL_ACQUIRE,
    idle: env.DB_POOL_IDLE
  }
});

export default sequelize;
