const express = require('express');
const router = express.Router();
const fs = require('fs');

// Leemos el archivo y devolvemos la lista de aulas
router.get('/', (req, res) => {
    const aulas = JSON.parse(fs.readFileSync('./data/aulas.json', 'utf-8'));
    res.json(aulas);
});

module.exports = router;