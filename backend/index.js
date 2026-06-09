import express from 'express';
import cors from 'cors';

import authRoutes from './src/routes/auth.routes.js';
import reservasRoutes from './src/routes/reservas.routes.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()); 

app.get('/', (req, res) => {
    res.send('Backend funcionando con ES Modules');
});

app.use('/api/reservas', reservasRoutes);
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});