import env from './src/config/env.js';
import app from './src/app.js';
import sequelize from './src/config/database.js';
import logger from './src/utils/logger.js';
import './src/models/index.js';

const PORT = env.PORT;

if (env.NODE_ENV !== 'test') {
  sequelize
    .authenticate()
    .then(() => {
      logger.info('conexion con postgresql establecida');
      app.listen(PORT, () => {
        logger.info('servidor escuchando', { puerto: PORT, entorno: env.NODE_ENV });
      });
    })
    .catch((error) => {
      logger.error('no se pudo conectar con la base de datos', { error });
      process.exit(1);
    });
}

export default app;
