import jwt from 'jsonwebtoken';
import Reserva from '../models/reserva.model.js';

const SECRET_KEY = "mi_clave_secreta_super_segura_dds_2026";

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
        return res.status(403).json({
            error: "Acceso denegado: se requieren permisos de administrador"
        });
    }

    next();
};

export const esPropietarioOAdmin = async (req, res, next) => {
    const reserva = await Reserva.findByPk(req.params.id);

    if (!reserva) {
        return res.status(404).json({
            error: "Reserva no encontrada"
        });
    }

    if (
        req.usuario.rol === 'admin' ||
        reserva.usuarioId === req.usuario.id
    ) {
        return next();
    }

    return res.status(403).json({
        error: "No tienes permisos para esta acción"
    });
};
