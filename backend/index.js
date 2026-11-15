import env from './src/config/env.js';
import app from './src/app.js';
import sequelize from './src/config/database.js';
import logger from './src/utils/logger.js';
import './src/models/index.js';

const PORT = env.PORT;

/**
 * Apagado ordenado.
 *
 * Un contenedor que se detiene recibe SIGTERM y, si nadie lo atiende, el
 * proceso muere de golpe: las peticiones en curso se cortan a mitad de camino y
 * las conexiones a PostgreSQL quedan del lado del servidor hasta que vencen.
 * Acá se deja de aceptar conexiones nuevas, se esperan las que están en vuelo y
 * recién entonces se cierra el pool.
 *
 * El plazo máximo evita el otro extremo: una petición colgada no puede impedir
 * que el proceso termine para siempre.
 */
const PLAZO_APAGADO_MS = 10000;

const apagarOrdenadamente = (servidor) => (senal) => {
  logger.info('apagando el servidor', { senal });

  const forzar = setTimeout(() => {
    logger.warn('el apagado ordenado no terminó a tiempo, se corta', { senal });
    process.exit(1);
  }, PLAZO_APAGADO_MS);
  forzar.unref();

  servidor.close(async () => {
    try {
      await sequelize.close();
      logger.info('conexiones cerradas, el proceso termina');
      process.exit(0);
    } catch (error) {
      logger.error('no se pudieron cerrar las conexiones', { error });
      process.exit(1);
    }
  });
};

if (env.NODE_ENV !== 'test') {
  sequelize
    .authenticate()
    .then(() => {
      logger.info('conexion con postgresql establecida');
      const servidor = app.listen(PORT, () => {
        logger.info('servidor escuchando', { puerto: PORT, entorno: env.NODE_ENV });
      });

      const apagar = apagarOrdenadamente(servidor);
      process.on('SIGTERM', () => apagar('SIGTERM'));
      process.on('SIGINT', () => apagar('SIGINT'));
    })
    .catch((error) => {
      logger.error('no se pudo conectar con la base de datos', { error });
      process.exit(1);
    });
}

export default app;
