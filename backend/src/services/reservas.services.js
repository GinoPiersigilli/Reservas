// services/reservas.service.js
import Reserva from '../models/reserva.model.js';
import Aula from '../models/aula.model.js';
import { Op } from 'sequelize'; // Operadores de Sequelize para hacer consultas complejas

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

  return nuevaReserva;
};