import express from 'express';
import jwt from 'jsonwebtoken';
// Importamos el modelo de Usuario para hablar con la base de datos
import Usuario from '../models/usuario.model.js'; 

const router = express.Router();
const SECRET_KEY = "clave_secreta_para_el_tp"; 

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // En vez de leer el JSON, buscamos el email en la tabla de SQLite
        const usuario = await Usuario.findOne({ where: { email: email } });

        // Si no lo encuentra o la contraseña no es 123456 (dejé tu misma regla)
        if (!usuario || password !== "123456") {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // Armamos el token
        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol }, 
            SECRET_KEY, 
            { expiresIn: '2h' } 
        );

        res.json({ mensaje: "Login exitoso", token });
    } catch (error) {
        console.error("Error en el login:", error);
        res.status(500).json({ error: "Hubo un problema al iniciar sesión" });
    }
});

export default router;