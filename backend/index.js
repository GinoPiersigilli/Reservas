import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.routes.js';
import reservasRoutes from './src/routes/reservas.routes.js';
import aulaRoutes from './src/routes/aulas.routes.js';
import { manejadorErrores } from './src/middleware/error.middleware.js';
import sequelize from './src/config/database.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()); 

// Ruta de prueba para ver si el navegador responde
app.get('/', (req, res) => {
    res.send('Backend funcionando con ES Modules');
});

// Activamos tus rutas en el servidor
app.use('/api/auth', authRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/aulas', aulaRoutes);

// FALTABA MIDDLEWARE DE MANEJO DE ERRORES (err, req, res, next)
app.use(manejadorErrores);

sequelize.sync()
  .then(() => {
    console.log('Base de datos SQLite sincronizada correctamente.');
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error al conectar con la base de datos:', error);
  });
