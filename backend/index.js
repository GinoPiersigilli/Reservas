import env from './src/config/env.js';
import app from './src/app.js';
import sequelize from './src/config/database.js';
import './src/models/index.js';

const PORT = env.PORT;

if (env.NODE_ENV !== 'test') {
  sequelize.authenticate()
    .then(() => {
      console.log('Conexión a PostgreSQL establecida correctamente.');
      app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Error al conectar con la base de datos:', error);
      process.exit(1);
    });
}

export default app;
