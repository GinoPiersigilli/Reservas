// services/reservas.service.js
import Reserva from '../models/reserva.model.js';
import sequelize from '../config/database.js';
import Aula from '../models/aula.model.js';
import { Op } from 'sequelize'; // Operadores de Sequelize para hacer consultas complejas
import { registrarAccion } from './historial.services.js';

// Función para crear una nueva reserva
export const crearNuevaReserva = async (datosReserva) => {
  const { aulaId, usuarioId, fecha, horaInicio, horaFin, cantidadPersonas, motivo } = datosReserva;

  // Validar que la horaInicio sea menor a horaFin
  if (horaInicio >= horaFin) {
    throw new Error('La hora de inicio debe ser menor a la hora de fin');
  }

  // ← AGREGÁS ESTO
  if (horaInicio < '08:00' || horaFin > '22:00') {
    const error = new Error('Las reservas solo se permiten entre las 08:00 y las 22:00');
    error.status = 400;
    throw error;
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

// ==========================================
// OBTENER RESERVAS (con filtros)
// ==========================================
export const obtenerReservas = async ({ fecha, estado, aulaId, q, page, limit, sortBy, order }) => {
  const where = {};

  if (fecha)   where.fecha   = fecha;
  if (estado)  where.estado  = estado;
  if (aulaId)  where.aulaId  = aulaId;
  if (q)       where.motivo  = { [Op.like]: `%${q}%` };

  const pagina    = parseInt(page)  || 1;
  const porPagina = parseInt(limit) || 10;
  const columna   = sortBy  || 'createdAt';
  const direccion = order   || 'DESC';

  const { count, rows } = await Reserva.findAndCountAll({
    where,
    order:  [[columna, direccion]],
    limit:  porPagina,
    offset: (pagina - 1) * porPagina
  });

  return {
    total:    count,
    pagina,
    porPagina,
    datos:    rows
  };
};

// ==========================================
// RECHAZAR RESERVA
// ==========================================
export const rechazarReserva = async (reservaId, usuarioIdAdmin) => {
  const reservaActual = await Reserva.findByPk(reservaId);

  if (!reservaActual) {
    const error = new Error('La reserva no existe');
    error.status = 404;
    throw error;
  }

  if (reservaActual.estado !== 'pendiente') {
    const error = new Error('Solo se pueden rechazar reservas pendientes');
    error.status = 400;
    throw error;
  }

  reservaActual.estado = 'rechazada';
  await reservaActual.save();

  await registrarAccion(
    reservaId,
    usuarioIdAdmin,
    'rechazo',
    { estado: 'pendiente' },
    { estado: 'rechazada' }
  );

  return reservaActual;
};


// ==========================================
// OBTENER RESERVA POR ID
// ==========================================
export const obtenerReservaPorId = async (reservaId) => {
  const reserva = await Reserva.findByPk(reservaId);

  if (!reserva) {
    const error = new Error('La reserva no existe');
    error.status = 404;
    throw error;
  }

  return reserva;
};

// ==========================================
// EDITAR RESERVA
// ==========================================
export const editarReserva = async (reservaId, datos, usuarioIdAdmin) => {
  const reserva = await Reserva.findByPk(reservaId);

  if (!reserva) {
    const error = new Error('La reserva no existe');
    error.status = 404;
    throw error;
  }

  if (reserva.estado === 'cancelada' || reserva.estado === 'rechazada') {
    const error = new Error('No se puede editar una reserva cancelada o rechazada');
    error.status = 400;
    throw error;
  }

  const { fecha, horaInicio, horaFin, cantidadPersonas, motivo } = datos;

  // Tomamos los valores nuevos o los actuales si no vienen en el body
  const nuevaFecha     = fecha            || reserva.fecha;
  const nuevaInicio    = horaInicio       || reserva.horaInicio;
  const nuevaFin       = horaFin          || reserva.horaFin;
  const nuevaCantidad  = cantidadPersonas || reserva.cantidadPersonas;

  if (nuevaInicio >= nuevaFin) {
    const error = new Error('La hora de inicio debe ser menor a la hora de fin');
    error.status = 400;
    throw error;
  }

  // Validar horario laboral (08:00 - 22:00)
  if (nuevaInicio < '08:00' || nuevaFin > '22:00') {
    const error = new Error('Las reservas solo se permiten entre las 08:00 y las 22:00');
    error.status = 400;
    throw error;
  }

  // Validar capacidad con el aula actual
  const aula = await Aula.findByPk(reserva.aulaId);
  if (nuevaCantidad > aula.capacidad) {
    const error = new Error('La cantidad de personas supera la capacidad del aula');
    error.status = 400;
    throw error;
  }

  // Detectar superposición ignorando la propia reserva
  const conflicto = await Reserva.findOne({
    where: {
      id:     { [Op.ne]: reservaId },   // ignora la reserva actual
      aulaId: reserva.aulaId,
      fecha:  nuevaFecha,
      estado: { [Op.in]: ['pendiente', 'aprobada'] },
      [Op.and]: [
        { horaInicio: { [Op.lt]: nuevaFin   } },
        { horaFin:    { [Op.gt]: nuevaInicio } }
      ]
    }
  });

  if (conflicto) {
    const error = new Error('El aula ya está reservada en ese horario');
    error.status = 400;
    throw error;
  }

  const valorAnterior = {
    fecha:            reserva.fecha,
    horaInicio:       reserva.horaInicio,
    horaFin:          reserva.horaFin,
    cantidadPersonas: reserva.cantidadPersonas,
    motivo:           reserva.motivo
  };

  // Aplicar cambios
  if (fecha)            reserva.fecha            = fecha;
  if (horaInicio)       reserva.horaInicio       = horaInicio;
  if (horaFin)          reserva.horaFin          = horaFin;
  if (cantidadPersonas) reserva.cantidadPersonas = cantidadPersonas;
  if (motivo)           reserva.motivo           = motivo;

  await reserva.save();

  await registrarAccion(
    reservaId,
    usuarioIdAdmin,
    'edicion',
    valorAnterior,
    { fecha: reserva.fecha, horaInicio: reserva.horaInicio, horaFin: reserva.horaFin, cantidadPersonas: reserva.cantidadPersonas, motivo: reserva.motivo }
  );

  return reserva;
};

// ==========================================
// RESUMEN ADMINISTRATIVO
// ==========================================
export const obtenerResumen = async () => {
  const [porEstado, porAula, proximas] = await Promise.all([
    // Total por estado
    Reserva.findAll({
      attributes: ['estado', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group: ['estado']
    }),
    // Reservas por aula (las más usadas)
    Reserva.findAll({
      attributes: ['aulaId', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group:  ['aulaId'],
      order:  [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit:  5
    }),
    // Próximas reservas aprobadas o pendientes
    Reserva.findAll({
      where: {
        estado: { [Op.in]: ['pendiente', 'aprobada'] },
        fecha:  { [Op.gte]: new Date().toISOString().split('T')[0] }
      },
      order: [['fecha', 'ASC'], ['horaInicio', 'ASC']],
      limit: 10
    })
  ]);

  return { porEstado, porAula, proximas };
};