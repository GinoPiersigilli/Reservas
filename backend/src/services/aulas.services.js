// services/aulas.service.js
import { Op } from 'sequelize';
import Aula from '../models/aula.model.js';
import Reserva from '../models/reserva.model.js';
import { esFechaValida } from '../utils/fecha.js';

// Función para obtener la lista de aulas
export const obtenerTodasLasAulas = async () => {
  // Usamos el método findAll de Sequelize para traer todos los registros de la tabla aulas
  const aulas = await Aula.findAll({
    // Opcional: Podés ordenarlas alfabéticamente por nombre o por edificio
    order: [['nombre', 'ASC']]
  });
  
  return aulas;
};

// Opcional pero muy recomendado: Función para traer solo las aulas activas
export const obtenerAulasActivas = async () => {
  const aulasActivas = await Aula.findAll({
    where: {
      activa: true // Solo trae las que están disponibles para reservas
    },
    order: [['nombre', 'ASC']]
  });
  
  return aulasActivas;
};

export const obtenerDisponibilidadAula = async (aulaId, fecha) => {
  const idStr = String(aulaId ?? '').trim();
  if (!/^\d+$/.test(idStr) || Number(idStr) <= 0) {
    const error = new Error('El aula solicitada no existe');
    error.status = 404;
    throw error;
  }

  const aula = await Aula.findByPk(Number(idStr));
  if (!aula) {
    const error = new Error('El aula solicitada no existe');
    error.status = 404;
    throw error;
  }

  if (!esFechaValida(fecha)) {
    const error = new Error('La fecha debe tener un formato válido YYYY-MM-DD');
    error.status = 400;
    throw error;
  }

  const reservasOcupadas = await Reserva.findAll({
    attributes: ['horaInicio', 'horaFin', 'estado'],
    where: {
      aulaId: aula.id,
      fecha,
      estado: {
        [Op.in]: ['pendiente', 'aprobada']
      }
    },
    order: [['horaInicio', 'ASC']]
  });

  return reservasOcupadas.map((r) => ({
    horaInicio: r.horaInicio,
    horaFin: r.horaFin,
    estado: r.estado
  }));
};
