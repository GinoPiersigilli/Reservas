// services/reservas.service.js
import Reserva from '../models/reserva.model.js';
import HistorialReserva from '../models/historial.model.js';
import sequelize from '../config/database.js';
import Aula from '../models/aula.model.js';
import Usuario from '../models/usuario.model.js';
import { Op } from 'sequelize'; // Operadores de Sequelize para hacer consultas complejas
import { registrarAccion } from './historial.services.js';
import env from '../config/env.js';
import { hoyArgentina, horaActualArgentina, esHorarioPasado } from '../utils/fecha.js';

const WORK_HOUR_START = env.WORK_HOUR_START;
const WORK_HOUR_END = env.WORK_HOUR_END;
const SORT_BY_PERMITIDOS = ['createdAt', 'fecha', 'horaInicio', 'estado', 'aulaId', 'id'];

const esErrorSolapamiento = (err) =>
  err?.name === 'SequelizeExclusionConstraintError' ||
  err?.parent?.code === '23P01' ||
  err?.original?.code === '23P01';

// Función para crear una nueva reserva
export const crearNuevaReserva = async (datosReserva) => {
  const { aulaId, usuarioId, fecha, horaInicio, horaFin, cantidadPersonas, motivo } = datosReserva;

  // Validar que la horaInicio sea menor a horaFin
  if (horaInicio >= horaFin) {
    const error = new Error('La hora de inicio debe ser menor a la hora de fin');
    error.status = 400;
    throw error;
  }

  if (horaInicio < WORK_HOUR_START || horaFin > WORK_HOUR_END) {
    const error = new Error(`Las reservas solo se permiten entre las ${WORK_HOUR_START} y las ${WORK_HOUR_END}`);
    error.status = 400;
    throw error;
  }

  if (esHorarioPasado(fecha, horaInicio)) {
    const error = new Error('No se pueden realizar reservas en horarios que ya han transcurrido');
    error.status = 400;
    throw error;
  }

  try {
    return await sequelize.transaction(async (transaction) => {
      // 2. Buscar el aula en la base de datos con bloqueo compartido para evitar carreras con baja
      const aula = await Aula.findByPk(aulaId, { transaction, lock: transaction.LOCK.SHARE });
      if (!aula) {
        const error = new Error('El aula solicitada no existe');
        error.status = 404;
        throw error;
      }
      if (!aula.activa) {
        const error = new Error('El aula no está activa para nuevas reservas');
        error.status = 400;
        throw error;
      }

      // 3. Validar la capacidad
      if (cantidadPersonas > aula.capacidad) {
        const error = new Error('La cantidad de personas supera la capacidad del aula');
        error.status = 400;
        throw error;
      }

      // 4. Validar que no haya superposición horaria (chequeo previo amable)
      const reservaExistente = await Reserva.findOne({
        where: {
          aulaId,
          fecha,
          estado: {
            [Op.in]: ['pendiente', 'aprobada']
          },
          [Op.and]: [
            { horaInicio: { [Op.lt]: horaFin } },
            { horaFin: { [Op.gt]: horaInicio } }
          ]
        },
        transaction
      });

      if (reservaExistente) {
        const error = new Error('El aula ya está reservada en ese horario');
        error.status = 400;
        throw error;
      }

      // 5. Creamos la reserva dentro de la transacción
      const nuevaReserva = await Reserva.create(
        {
          aulaId,
          usuarioId,
          fecha,
          horaInicio,
          horaFin,
          cantidadPersonas,
          motivo,
          estado: 'pendiente'
        },
        { transaction }
      );

      // 6. Guardamos la creación en el historial dentro de la misma transacción
      await registrarAccion(
        nuevaReserva.id,
        usuarioId,
        'creacion',
        null,
        { estado: 'pendiente' },
        { transaction }
      );

      return nuevaReserva;
    });
  } catch (err) {
    if (esErrorSolapamiento(err)) {
      const error = new Error('El aula ya está reservada en ese horario');
      error.status = 400;
      throw error;
    }
    throw err;
  }
};
// ==========================================
// 2. APROBAR RESERVA
// ==========================================
export const aprobarReserva = async (reservaId, usuarioIdAdmin) => {
  return await sequelize.transaction(async (transaction) => {
    // 1. Buscamos la reserva usando Sequelize
    const reservaActual = await Reserva.findByPk(reservaId, { transaction });

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

    // NOTA: No hace falta re-chequear solapamiento al aprobar porque la constraint
    // de exclusión `reservas_sin_solapamiento` en PostgreSQL aplica tanto al estado
    // 'pendiente' como a 'aprobada' (`WHERE (estado IN ('pendiente', 'aprobada'))`).
    // Cualquier reserva pendiente ya tiene garantizada su franja sin colisiones.

    // 3. Ejecutamos el cambio y guardamos en la base de datos
    reservaActual.estado = 'aprobada';
    await reservaActual.save({ transaction });

    // 4. Registramos en el historial (si falla, se revierte el cambio de estado)
    await registrarAccion(
      reservaId,
      usuarioIdAdmin,
      'aprobacion',
      { estado: 'pendiente' },
      { estado: 'aprobada' },
      { transaction }
    );

    return reservaActual;
  });
};

// ==========================================
// CANCELAR RESERVA
// ==========================================
export const cancelarReserva = async (reservaId, usuarioLogueado) => {
  return await sequelize.transaction(async (transaction) => {
    // 1. Buscamos la reserva
    const reservaActual = await Reserva.findByPk(reservaId, { transaction });

    if (!reservaActual) {
      const error = new Error("La reserva no existe");
      error.status = 404;
      throw error;
    }

    // 2. Validación de permisos por lista explícita (admin o dueño)
    const esAdmin = usuarioLogueado?.rol === 'admin';
    const esDuenio =
      usuarioLogueado?.id !== undefined &&
      usuarioLogueado?.id !== null &&
      String(reservaActual.usuarioId) === String(usuarioLogueado.id);

    if (!esAdmin && !esDuenio) {
      const error = new Error("No tienes permiso para cancelar esta reserva");
      error.status = 403;
      throw error;
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
    await reservaActual.save({ transaction });

    // 5. Registramos en el historial (si falla, se revierte el cambio de estado)
    await registrarAccion(
      reservaId,
      usuarioLogueado.id,
      'cancelacion',
      { estado: estadoAnterior },
      { estado: 'cancelada' },
      { transaction }
    );

    return reservaActual;
  });
};

// ==========================================
// OBTENER RESERVAS (con filtros)
// ==========================================
export const obtenerReservas = async ({ fecha, estado, aulaId, q, page, limit, sortBy, order, usuario } = {}, usuarioParam) => {
  const where = {};
  const usuarioActual = usuarioParam || usuario;
  const esAdmin = usuarioActual && usuarioActual.rol === 'admin';

  if (usuarioActual && !esAdmin) {
    where.usuarioId = usuarioActual.id;
  }

  if (fecha)   where.fecha   = fecha;
  if (estado)  where.estado  = estado;
  if (aulaId)  where.aulaId  = aulaId;
  if (q)       where.motivo  = { [Op.like]: `%${q}%` };

  const parsedPage  = parseInt(page, 10);
  const pagina      = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const parsedLimit = parseInt(limit, 10);
  const porPagina   = Number.isNaN(parsedLimit) || parsedLimit < 1
    ? 10
    : Math.min(parsedLimit, 100);

  const columna     = SORT_BY_PERMITIDOS.includes(sortBy) ? sortBy : 'createdAt';
  const orderUpper  = typeof order === 'string' ? order.toUpperCase() : '';
  const direccion   = orderUpper === 'ASC' || orderUpper === 'DESC' ? orderUpper : 'DESC';

  const include = esAdmin
    ? [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre', 'email'] }]
    : [];

  const { count, rows } = await Reserva.findAndCountAll({
    where,
    include,
    distinct: true,
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
  return await sequelize.transaction(async (transaction) => {
    const reservaActual = await Reserva.findByPk(reservaId, { transaction });

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
    await reservaActual.save({ transaction });

    await registrarAccion(
      reservaId,
      usuarioIdAdmin,
      'rechazo',
      { estado: 'pendiente' },
      { estado: 'rechazada' },
      { transaction }
    );

    return reservaActual;
  });
};


// ==========================================
// OBTENER RESERVA POR ID
// ==========================================
export const obtenerReservaPorId = async (reservaId, usuario) => {
  const esAdmin = usuario && usuario.rol === 'admin';
  const include = esAdmin
    ? [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre', 'email'] }]
    : [];

  const reserva = await Reserva.findByPk(reservaId, { include });

  if (!reserva) {
    const error = new Error('La reserva no existe');
    error.status = 404;
    throw error;
  }

  if (usuario && !esAdmin && String(reserva.usuarioId) !== String(usuario.id)) {
    const error = new Error('La reserva no existe');
    error.status = 404;
    throw error;
  }

  return reserva;
};

// ==========================================
// OBTENER HISTORIAL DE UNA RESERVA
// ==========================================
export const obtenerHistorialDeReserva = async (reservaId, usuario) => {
  await obtenerReservaPorId(reservaId, usuario);

  const historial = await HistorialReserva.findAll({
    where: { reservaId },
    order: [['fechaHora', 'DESC']]
  });

  return historial;
};

// ==========================================
// EDITAR RESERVA
// ==========================================
export const editarReserva = async (reservaId, datos, usuarioIdAdmin) => {
  try {
    return await sequelize.transaction(async (transaction) => {
      const reserva = await Reserva.findByPk(reservaId, { transaction });

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

      const { aulaId, fecha, horaInicio, horaFin, cantidadPersonas, motivo } = datos;

      // Tomamos los valores nuevos o los actuales si son undefined
      const nuevoAulaId   = aulaId           !== undefined ? aulaId           : reserva.aulaId;
      const nuevaFecha    = fecha            !== undefined ? fecha            : reserva.fecha;
      const nuevaInicio   = horaInicio       !== undefined ? horaInicio       : reserva.horaInicio;
      const nuevaFin      = horaFin          !== undefined ? horaFin          : reserva.horaFin;
      const nuevaCantidad = cantidadPersonas !== undefined ? cantidadPersonas : reserva.cantidadPersonas;
      const nuevoMotivo   = motivo           !== undefined ? motivo           : reserva.motivo;

      if (!Number.isInteger(Number(nuevaCantidad)) || Number(nuevaCantidad) <= 0) {
        const error = new Error('La cantidad de personas debe ser un número entero mayor a 0');
        error.status = 400;
        throw error;
      }

      if (typeof nuevoMotivo !== 'string' || nuevoMotivo.trim().length === 0) {
        const error = new Error('El motivo no puede estar vacío');
        error.status = 400;
        throw error;
      }

      if (nuevaInicio >= nuevaFin) {
        const error = new Error('La hora de inicio debe ser menor a la hora de fin');
        error.status = 400;
        throw error;
      }

      // Validar horario laboral mediante configuración
      if (nuevaInicio < WORK_HOUR_START || nuevaFin > WORK_HOUR_END) {
        const error = new Error(`Las reservas solo se permiten entre las ${WORK_HOUR_START} y las ${WORK_HOUR_END}`);
        error.status = 400;
        throw error;
      }

      if (esHorarioPasado(nuevaFecha, nuevaInicio)) {
        const error = new Error('No se pueden realizar reservas en horarios que ya han transcurrido');
        error.status = 400;
        throw error;
      }

      // Validar existencia, estado activo y capacidad del aula con bloqueo compartido
      const aula = await Aula.findByPk(nuevoAulaId, { transaction, lock: transaction.LOCK.SHARE });
      if (!aula) {
        const error = new Error('El aula solicitada no existe');
        error.status = 404;
        throw error;
      }
      if (!aula.activa) {
        const error = new Error('El aula no está activa para nuevas reservas');
        error.status = 400;
        throw error;
      }
      if (nuevaCantidad > aula.capacidad) {
        const error = new Error('La cantidad de personas supera la capacidad del aula');
        error.status = 400;
        throw error;
      }

      // Detectar superposición ignorando la propia reserva (chequeo previo amable)
      const conflicto = await Reserva.findOne({
        where: {
          id:     { [Op.ne]: reservaId },
          aulaId: nuevoAulaId,
          fecha:  nuevaFecha,
          estado: { [Op.in]: ['pendiente', 'aprobada'] },
          [Op.and]: [
            { horaInicio: { [Op.lt]: nuevaFin   } },
            { horaFin:    { [Op.gt]: nuevaInicio } }
          ]
        },
        transaction
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

      // Aplicar cambios usando !== undefined
      if (aulaId           !== undefined) reserva.aulaId           = aulaId;
      if (fecha            !== undefined) reserva.fecha            = fecha;
      if (horaInicio       !== undefined) reserva.horaInicio       = horaInicio;
      if (horaFin          !== undefined) reserva.horaFin          = horaFin;
      if (cantidadPersonas !== undefined) reserva.cantidadPersonas = cantidadPersonas;
      if (motivo           !== undefined) reserva.motivo           = motivo;

      await reserva.save({ transaction });

      await registrarAccion(
        reservaId,
        usuarioIdAdmin,
        'edicion',
        valorAnterior,
        { fecha: reserva.fecha, horaInicio: reserva.horaInicio, horaFin: reserva.horaFin, cantidadPersonas: reserva.cantidadPersonas, motivo: reserva.motivo },
        { transaction }
      );

      return reserva;
    });
  } catch (err) {
    if (esErrorSolapamiento(err)) {
      const error = new Error('El aula ya está reservada en ese horario');
      error.status = 400;
      throw error;
    }
    throw err;
  }
};

// ==========================================
// RESUMEN ADMINISTRATIVO
// ==========================================
export const obtenerResumen = async (usuario) => {
  const fechaHoy = hoyArgentina();
  const horaAhora = horaActualArgentina();
  const esAdmin = usuario && usuario.rol === 'admin';

  const includeProximas = esAdmin
    ? [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre', 'email'] }]
    : [];

  const [porEstado, porAula, proximasHoy, todasAulas] = await Promise.all([
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
    // Próximas reservas del día
    Reserva.findAll({
      where: {
        estado: { [Op.in]: ['pendiente', 'aprobada'] },
        fecha:  fechaHoy,
        horaInicio: { [Op.gte]: horaAhora }
      },
      include: includeProximas,
      order: [['horaInicio', 'ASC']],
      limit: 10
    }),
    // Aulas activas para análisis de ocupación
    Aula.findAll({
      where: { activa: true },
      attributes: ['id', 'nombre', 'capacidad', 'ubicacion'],
      order: [['nombre', 'ASC']]
    })
  ]);

  // 1. Distribución de estados con porcentajes
  const totalReservas = porEstado.reduce(
    (acc, curr) => acc + (parseInt(curr.dataValues?.total || curr.total, 10) || 0),
    0
  );
  const mapaEstados = new Map(
    porEstado.map((item) => [item.estado, parseInt(item.dataValues?.total || item.total, 10) || 0])
  );
  const estadosPosibles = ['aprobada', 'pendiente', 'rechazada', 'cancelada'];
  const distribucionEstados = estadosPosibles.map((est) => {
    const cantidad = mapaEstados.get(est) || 0;
    const porcentaje = totalReservas > 0 ? Math.round((cantidad / totalReservas) * 100) : 0;
    return {
      estado: est,
      cantidad,
      porcentaje
    };
  });

  // 2. Tasa de ocupación por aula en el mes actual
  const inicioMes = `${fechaHoy.slice(0, 7)}-01`;
  const [anioHoy, mesHoy] = fechaHoy.split('-').map(Number);
  const ultimoDiaMes = new Date(Date.UTC(anioHoy, mesHoy, 0)).getUTCDate();
  const finMes = `${fechaHoy.slice(0, 7)}-${String(ultimoDiaMes).padStart(2, '0')}`;

  const reservasMes = await Reserva.findAll({
    where: {
      estado: { [Op.in]: ['pendiente', 'aprobada'] },
      fecha: { [Op.between]: [inicioMes, finMes] }
    },
    attributes: ['aulaId', 'horaInicio', 'horaFin']
  });

  const calcularHoras = (hInicio, hFin) => {
    const [hI, mI] = String(hInicio).split(':').map(Number);
    const [hF, mF] = String(hFin).split(':').map(Number);
    return Math.max(0, (hF * 60 + mF - (hI * 60 + mI)) / 60);
  };

  const horasOcupadasPorAula = new Map();
  reservasMes.forEach((r) => {
    const duracion = calcularHoras(r.horaInicio, r.horaFin);
    const prev = horasOcupadasPorAula.get(r.aulaId) || 0;
    horasOcupadasPorAula.set(r.aulaId, prev + duracion);
  });

  // Horas operativas disponibles en el mes (14 hs diarias operativas entre 08:00 y 22:00)
  const horasOperativasMes = ultimoDiaMes * 14;

  const tasaOcupacionAulas = todasAulas.map((a) => {
    const horasOcupadas = horasOcupadasPorAula.get(a.id) || 0;
    const tasa = horasOperativasMes > 0
      ? Math.min(100, Math.round((horasOcupadas / horasOperativasMes) * 100))
      : 0;
    return {
      aulaId: a.id,
      nombre: a.nombre,
      capacidad: a.capacidad,
      ubicacion: a.ubicacion,
      horasOcupadas: Number(horasOcupadas.toFixed(1)),
      horasDisponibles: horasOperativasMes,
      tasaOcupacion: tasa
    };
  });

  // 3. Aulas de mayor demanda
  const mapaTotalReservasAula = new Map(
    porAula.map((item) => [item.aulaId, parseInt(item.dataValues?.total || item.total, 10) || 0])
  );
  const aulasMayorDemanda = [...tasaOcupacionAulas]
    .map((item) => ({
      ...item,
      totalReservas: mapaTotalReservasAula.get(item.aulaId) || 0
    }))
    .sort((a, b) => b.horasOcupadas - a.horasOcupadas || b.totalReservas - a.totalReservas)
    .slice(0, 5);

  return {
    porEstado,
    porAula,
    proximasHoy,
    distribucionEstados,
    tasaOcupacionAulas,
    aulasMayorDemanda,
    totalReservas
  };
};
