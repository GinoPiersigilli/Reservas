import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const router = express.Router();
const SECRET_KEY = "clave_secreta_para_el_tp"; 

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    // Acá leemos el archivo con tus usuarios
    const usuarios = JSON.parse(fs.readFileSync('./data/usuarios.json', 'utf-8'));
    
    const usuario = usuarios.find(u => u.email === email);

    if (!usuario || password !== "123456") {
        return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
        { id: usuario.id, rol: usuario.rol }, 
        SECRET_KEY, 
        { expiresIn: '2h' } 
    );

    res.json({ mensaje: "Login exitoso", token });
});

export default router;