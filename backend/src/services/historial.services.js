// src/services/historial.services.js

export const registrarAccion = async (reservaId, usuarioId, accion, valorAnterior, valorNuevo) => {
  const nuevoRegistro = {
    reservaId,
    usuarioId, // El ID de quien ejecutó la acción (ej: el admin que aprobó)
    accion,    // 'creacion', 'edicion', 'aprobacion', 'rechazo', 'cancelacion'
    fechaHora: new Date().toISOString(),
    valorAnterior,
    valorNuevo
  };

  // Acá ejecutás el guardado real en tu motor de persistencia.
  // Ej: await Historial.create(nuevoRegistro);
};