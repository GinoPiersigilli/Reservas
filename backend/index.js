import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.routes.js';
import reservasRoutes from './src/routes/reservas.routes.js';

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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});