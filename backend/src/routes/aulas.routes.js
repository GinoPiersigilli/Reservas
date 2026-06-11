import express from 'express';
import Aula from '../models/aula.model.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const aulas = await Aula.findAll(); 
        res.json(aulas);
    } catch (error) {
        console.error('Falló la búsqueda de aulas:', error);
        res.status(500).json({ error: 'Hubo un problema al traer las aulas' });
    }
});

export default router;