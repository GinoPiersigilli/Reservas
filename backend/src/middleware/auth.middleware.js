import jwt from 'jsonwebtoken';

const SECRET_KEY = "clave_secreta_para_el_tp"; 

export const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "No enviaste el token de acceso" });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decodificado = jwt.verify(token, SECRET_KEY);
        req.usuario = decodificado; 
        next(); 
    } catch (error) {
        return res.status(401).json({ error: "Token inválido o vencido" });
    }
};

export const soloAdmin = (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: "Acceso denegado: se requieren permisos de administrador" });
    }
    next(); 
};