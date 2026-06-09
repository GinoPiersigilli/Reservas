import express from 'express';
const router = express.Router();

// Controlador falso para que no explote hasta que tu amigo lo termine
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

router.get('/resumen', reservasController.obtenerResumen); 
router.get('/', reservasController.listarReservas); 
router.post('/', reservasController.crearReserva); 
router.get('/:id', reservasController.obtenerReservaPorId); 
router.get('/:id/historial', reservasController.obtenerHistorial); 
router.put('/:id', reservasController.editarReserva); 
router.patch('/:id/cancelar', reservasController.cancelarReserva); 
router.patch('/:id/aprobar', reservasController.aprobarReserva); 
router.patch('/:id/rechazar', reservasController.rechazarReserva); 

export default router;