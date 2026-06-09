const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()); 

app.get('/', (req, res) => {
    res.send('Backend funcionando');
});

const aulasRoutes = require('./routes/aulas.routes');
app.use('/api/aulas', aulasRoutes);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});