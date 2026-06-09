// services/aulas.service.js
import Aula from '../models/aula.model.js';

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