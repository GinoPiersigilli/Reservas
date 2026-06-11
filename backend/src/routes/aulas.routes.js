import express from 'express';
import fs from 'fs';
import path from 'path'; // 1. Importá path
import { fileURLToPath } from 'url'; // 2. Necesario para calcular __dirname en ES Modules

const router = express.Router();

// Esto calcula la ruta absoluta a la carpeta backend
const __dirname = path.dirname(fileURLToPath(import.meta.url));

router.get('/', (req, res) => {
    // 3. Construimos la ruta exacta: va a buscar a la carpeta 'data' en la raíz de backend
    const filePath = path.join(__dirname, '../../data/aulas.json');
    const aulas = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(aulas);
});

export default router;