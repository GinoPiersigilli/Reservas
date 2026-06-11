// services/reservas.service.js
import Reserva from '../models/reserva.model.js';
import Aula from '../models/aula.model.js';
import { Op } from 'sequelize'; // Operadores de Sequelize para hacer consultas complejas
import { registrarAccion } from './historial.services.js';

// Función para crear una nueva reserva
export const crearNuevaReserva = async (datosReserva) => {
  const { aulaId, usuarioId, fecha, horaInicio, horaFin, cantidadPersonas, motivo } = datosReserva;

  // 1. Validar que la horaInicio sea menor a horaFin
  if (horaInicio >= horaFin) {
    throw new Error('La hora de inicio debe ser menor a la hora de fin');
  }

  // 2. Buscar el aula en la base de datos
  const aula = await Aula.findByPk(aulaId);
  if (!aula) {
    throw new Error('El aula solicitada no existe');
  }
  if (!aula.activa) {
    throw new Error('El aula no está activa para nuevas reservas');
  }

  // 3. Validar la capacidad
  if (cantidadPersonas > aula.capacidad) {
    throw new Error('La cantidad de personas supera la capacidad del aula');
  }

  // 4. Validar que no haya superposición horaria
  // Buscamos si ya existe alguna reserva aprobada o pendiente para ese aula y fecha...
  const reservaExistente = await Reserva.findOne({
    where: {
      aulaId,
      fecha,
      estado: {
        [Op.in]: ['pendiente', 'aprobada'] // Filtramos solo las que ocupan lugar
      },
      // Lógica para detectar si las franjas se pisan
      [Op.and]: [
        { horaInicio: { [Op.lt]: horaFin } }, // Empieza antes de que termine la nueva
        { horaFin: { [Op.gt]: horaInicio } }  // Termina después de que empiece la nueva
      ]
    }
  });

  if (reservaExistente) {
    throw new Error('El aula ya está reservada en ese horario');
  }

  // 5. Si pasó todas las pruebas, creamos la reserva
  const nuevaReserva = await Reserva.create({
    aulaId,
    usuarioId,
    fecha,
    horaInicio,
    horaFin,
    cantidadPersonas,
    motivo,
    estado: 'pendiente' // Nace como pendiente por defecto
  });

// 6. ¡AGREGADO! Guardamos la creación en el historial
  await registrarAccion(
    nuevaReserva.id, // El ID de la reserva recién creada
    usuarioId,       // El usuario que la solicitó
    'creacion',
    null,            // No hay valor anterior porque es nueva
    { estado: 'pendiente' } // Valor nuevo
  );



  return nuevaReserva;
};
// ==========================================
// 2. APROBAR RESERVA
// ==========================================
export const aprobarReserva = async (reservaId, usuarioIdAdmin) => {
  // 1. Buscamos la reserva usando Sequelize
  const reservaActual = await Reserva.findByPk(reservaId);

  if (!reservaActual) {
    const error = new Error("La reserva no existe");
    error.status = 404;
    throw error;
  }

  // 2. Validamos el flujo de estados
  // Solo se permite pasar de 'pendiente' a 'aprobada' o 'rechazada'[cite: 67].
  if (reservaActual.estado !== 'pendiente') {
    const error = new Error("Solo se pueden aprobar reservas pendientes");
    error.status = 400;
    throw error;
  }

  // 3. Ejecutamos el cambio y guardamos en la base de datos
  reservaActual.estado = 'aprobada';
  await reservaActual.save();

  // 4. Registramos en el historial
  await registrarAccion(
    reservaId,
    usuarioIdAdmin, // Quien disparó la ruta (viene del JWT de admin)
    'aprobacion',
    { estado: 'pendiente' }, // valorAnterior
    { estado: 'aprobada' }   // valorNuevo
  );

  return reservaActual;

};

// ==========================================
// CANCELAR RESERVA
// ==========================================
export const cancelarReserva = async (reservaId, usuarioLogueado) => {
  // 1. Buscamos la reserva
  const reservaActual = await Reserva.findByPk(reservaId);

  if (!reservaActual) {
    const error = new Error("La reserva no existe");
    error.status = 404;
    throw error;
  }

  // 2. Validación de permisos (La clave que pide el PDF)
  // Si es un usuario común, verificamos que sea el dueño de la reserva
  if (usuarioLogueado.rol === 'usuario') {
    if (reservaActual.usuarioId !== usuarioLogueado.id) {
      const error = new Error("No tienes permiso para cancelar esta reserva");
      error.status = 403; // 403 Forbidden como exige el enunciado
      throw error;
    }
  }

  // 3. Validación de estado
  // Solo se pueden cancelar reservas pendientes o aprobadas
  if (reservaActual.estado !== 'pendiente' && reservaActual.estado !== 'aprobada') {
    const error = new Error("Solo se pueden cancelar reservas pendientes o aprobadas");
    error.status = 400;
    throw error;
  }

  // Guardamos el estado anterior para el historial
  const estadoAnterior = reservaActual.estado;

  // 4. Ejecutamos el cambio sin borrar físicamente
  reservaActual.estado = 'cancelada';
  await reservaActual.save();

  // 5. Registramos en el historial
  await registrarAccion(
    reservaId,
    usuarioLogueado.id, // Quien ejecutó la acción
    'cancelacion',
    { estado: estadoAnterior }, // valorAnterior
    { estado: 'cancelada' }     // valorNuevo
  );

  return reservaActual;

};