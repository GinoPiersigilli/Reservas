const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()); 

app.get('/', (req, res) => {
    res.send('Backend funcionando');
});

const aulasRoutes = require('./src/routes/aulas.routes');
app.use('/api/aulas', aulasRoutes);

const reservasRoutes = require('./src/routes/reservas.routes');
app.use('/api/reservas', reservasRoutes); 

const authRoutes = require('./src/routes/auth.routes');
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});