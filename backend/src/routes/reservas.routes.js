import express from 'express';
// Acá traemos tus controles
import { verificarToken, soloAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

const reservasController = {
    obtenerResumen: (req, res) => res.send("Resumen funcionando"),
    listarReservas: (req, res) => res.send("Listado funcionando"),
    crearReserva: (req, res) => res.send("Crear funcionando"),
    obtenerReservaPorId: (req, res) => res.send("Detalle funcionando"),
    obtenerHistorial: (req, res) => res.send("Historial funcionando"),
    editarReserva: (req, res) => res.send("Editar funcionando"),
    cancelarReserva: (req, res) => res.send("Cancelar funcionando"),
    aprobarReserva: (req, res) => res.send("Aprobar funcionando"),
    rechazarReserva: (req, res) => res.send("Rechazar funcionando")
};

// Rutas públicas (no tienen el control en el medio)
router.get('/resumen', reservasController.obtenerResumen); 
router.get('/', reservasController.listarReservas); 

// Rutas protegidas (ACÁ ESTÁ LA CLAVE: el verificarToken frena el pedido antes de crear)
router.post('/', verificarToken, reservasController.crearReserva); 
router.get('/:id', verificarToken, reservasController.obtenerReservaPorId); 
router.get('/:id/historial', verificarToken, reservasController.obtenerHistorial); 

// Rutas de administrador (tienen doble control)
router.put('/:id', verificarToken, soloAdmin, reservasController.editarReserva); 
router.patch('/:id/cancelar', verificarToken, soloAdmin, reservasController.cancelarReserva); 
router.patch('/:id/aprobar', verificarToken, soloAdmin, reservasController.aprobarReserva); 
router.patch('/:id/rechazar', verificarToken, soloAdmin, reservasController.rechazarReserva); 

export default router;