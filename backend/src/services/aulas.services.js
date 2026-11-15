// services/aulas.service.js
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Aula from '../models/aula.model.js';
import Reserva from '../models/reserva.model.js';
import { registrarAccionesEnLote, registrarAccionAula } from './historial.services.js';
import { esFechaValida, hoyArgentina, horaActualArgentina } from '../utils/fecha.js';

/**
 * Lo que todavía no terminó: de mañana en adelante, o de hoy si aún no pasó.
 *
 * Con `fecha >= hoy` a secas, una reserva de hoy a las ocho de la mañana seguía
 * contando como futura a las seis de la tarde. Eso bloqueaba reducciones de
 * capacidad por una reserva ya dada, y una baja de aula cancelaba
 * retroactivamente reservas que ya habían ocurrido.
 */
const condicionReservaFutura = (ahora = new Date()) => {
  const hoy = hoyArgentina(ahora);
  return {
    estado: { [Op.in]: ['pendiente', 'aprobada'] },
    [Op.or]: [
      { fecha: { [Op.gt]: hoy } },
      { fecha: hoy, horaFin: { [Op.gt]: horaActualArgentina(ahora) } }
    ]
  };
};

// Función para obtener la lista de todas las aulas
export const obtenerTodasLasAulas = async () => {
  const aulas = await Aula.findAll({
    order: [['nombre', 'ASC']]
  });
  return aulas;
};

// Función para traer solo las aulas activas
export const obtenerAulasActivas = async () => {
  const aulasActivas = await Aula.findAll({
    where: {
      activa: true
    },
    order: [['nombre', 'ASC']]
  });
  return aulasActivas;
};

// Obtención con soporte para filtro incluirInactivas (solo efectivo si el solicitante es admin)
export const obtenerAulas = async ({ usuario, incluirInactivas } = {}) => {
  const esAdmin = usuario?.rol === 'admin';
  if (esAdmin && (incluirInactivas === true || incluirInactivas === 'true')) {
    return await obtenerTodasLasAulas();
  }
  return await obtenerAulasActivas();
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

  if (!aula.activa) {
    const error = new Error('El aula no está activa');
    error.status = 400;
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

/**
 * La disponibilidad de todas las aulas activas en una fecha, de una sola vez.
 *
 * La grilla necesita el día entero, y pedirlo aula por aula significaba una
 * petición HTTP por aula cada vez que alguien cambiaba la fecha. Con unas
 * decenas de aulas, unos pocos cambios de fecha agotan el límite por IP y la
 * persona queda bloqueada con un 429 sin haber hecho nada raro.
 *
 * Devuelve las franjas agrupadas por aula, con el `id` de cada reserva: el
 * formulario de edición lo necesita para no contarse a sí mismo como ocupado.
 */
export const obtenerDisponibilidadDeTodas = async (fecha) => {
  if (!esFechaValida(fecha)) {
    const error = new Error('La fecha debe tener un formato válido YYYY-MM-DD');
    error.status = 400;
    throw error;
  }

  const aulas = await Aula.findAll({
    attributes: ['id'],
    where: { activa: true },
    order: [['id', 'ASC']]
  });

  const reservas = await Reserva.findAll({
    attributes: ['id', 'aulaId', 'horaInicio', 'horaFin', 'estado'],
    where: {
      aulaId: { [Op.in]: aulas.map((a) => a.id) },
      fecha,
      estado: { [Op.in]: ['pendiente', 'aprobada'] }
    },
    order: [
      ['aulaId', 'ASC'],
      ['horaInicio', 'ASC']
    ]
  });

  // Todas las aulas activas aparecen, también las que no tienen nada: su
  // ausencia y «no pude consultarla» no pueden parecer lo mismo.
  const porAula = new Map(aulas.map((a) => [a.id, []]));
  reservas.forEach((r) => {
    porAula.get(r.aulaId)?.push({
      id: r.id,
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
      estado: r.estado
    });
  });

  return [...porAula.entries()].map(([aulaId, franjas]) => ({ aulaId, franjas }));
};

export const crearAula = async (datos, usuarioIdAdmin) => {
  const { nombre, ubicacion, capacidad, recursos } = datos;
  const nombreTrim = nombre.trim();

  // Verificación previa de unicidad case-insensitive
  const duplicada = await Aula.findOne({
    where: sequelize.where(sequelize.fn('LOWER', sequelize.col('nombre')), nombreTrim.toLowerCase())
  });

  if (duplicada) {
    const error = new Error('Ya existe un aula con ese nombre');
    error.status = 409;
    throw error;
  }

  return await sequelize.transaction(async (transaction) => {
    const nuevaAula = await Aula.create(
      {
        nombre: nombreTrim,
        ubicacion: ubicacion.trim(),
        capacidad: Number(capacidad),
        recursos: recursos ? recursos.trim() : null,
        activa: true
      },
      { transaction }
    );

    await registrarAccionAula(
      nuevaAula.id,
      usuarioIdAdmin,
      'creacion',
      null,
      {
        nombre: nuevaAula.nombre,
        ubicacion: nuevaAula.ubicacion,
        capacidad: nuevaAula.capacidad,
        recursos: nuevaAula.recursos,
        activa: nuevaAula.activa
      },
      { transaction }
    );

    return nuevaAula;
  });
};

/** El nombre del aula es único sin distinguir mayúsculas. */
const verificarNombreDisponible = async (id, nombre, transaction) => {
  if (nombre === undefined) return;

  const duplicada = await Aula.findOne({
    where: {
      id: { [Op.ne]: id },
      [Op.and]: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('nombre')),
        nombre.trim().toLowerCase()
      )
    },
    transaction
  });

  if (duplicada) {
    const error = new Error('Ya existe un aula con ese nombre');
    error.status = 409;
    throw error;
  }
};

/** La capacidad no puede quedar por debajo de las reservas futuras ya aceptadas. */
const verificarCapacidadSuficiente = async (id, capacidad, transaction) => {
  if (capacidad === undefined) return;

  const nuevaCapacidad = Number(capacidad);
  const reservasFuturas = await Reserva.findAll({
    where: { aulaId: id, ...condicionReservaFutura() },
    attributes: ['id', 'cantidadPersonas', 'fecha', 'horaInicio'],
    transaction
  });

  const maxPersonas = reservasFuturas.reduce((max, r) => Math.max(max, r.cantidadPersonas), 0);
  if (nuevaCapacidad >= maxPersonas) return;

  const error = new Error(
    'No se puede reducir la capacidad por debajo de las reservas futuras existentes'
  );
  error.status = 409;
  error.capacidadMaximaRequerida = maxPersonas;
  error.detalle = {
    capacidadSolicitada: nuevaCapacidad,
    capacidadMaximaRequerida: maxPersonas,
    reservasAfectadas: reservasFuturas.filter((r) => r.cantidadPersonas > nuevaCapacidad).length
  };
  throw error;
};

export const editarAula = async (id, datos, usuarioIdAdmin) => {
  return await sequelize.transaction(async (transaction) => {
    const aula = await Aula.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!aula) {
      const error = new Error('El aula solicitada no existe');
      error.status = 404;
      throw error;
    }

    await verificarNombreDisponible(id, datos.nombre, transaction);
    await verificarCapacidadSuficiente(id, datos.capacidad, transaction);

    const valorAnterior = {
      nombre: aula.nombre,
      ubicacion: aula.ubicacion,
      capacidad: aula.capacidad,
      recursos: aula.recursos,
      activa: aula.activa
    };

    if (datos.nombre !== undefined) aula.nombre = datos.nombre.trim();
    if (datos.ubicacion !== undefined) aula.ubicacion = datos.ubicacion.trim();
    if (datos.capacidad !== undefined) aula.capacidad = Number(datos.capacidad);
    if (datos.recursos !== undefined) aula.recursos = datos.recursos ? datos.recursos.trim() : null;

    await aula.save({ transaction });

    const valorNuevo = {
      nombre: aula.nombre,
      ubicacion: aula.ubicacion,
      capacidad: aula.capacidad,
      recursos: aula.recursos,
      activa: aula.activa
    };

    await registrarAccionAula(aula.id, usuarioIdAdmin, 'edicion', valorAnterior, valorNuevo, {
      transaction
    });

    return aula;
  });
};

export const desactivarAula = async (
  id,
  { cancelarReservasFuturas, motivo } = {},
  usuarioIdAdmin
) => {
  return await sequelize.transaction(async (transaction) => {
    const aula = await Aula.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!aula) {
      const error = new Error('El aula solicitada no existe');
      error.status = 404;
      throw error;
    }

    const reservasFuturas = await Reserva.findAll({
      where: { aulaId: id, ...condicionReservaFutura() },
      transaction
    });

    if (reservasFuturas.length > 0 && !cancelarReservasFuturas) {
      const error = new Error('El aula tiene reservas futuras activas');
      error.status = 409;
      error.reservasAfectadas = reservasFuturas.length;
      throw error;
    }

    if (reservasFuturas.length > 0 && cancelarReservasFuturas) {
      // En lote y no una por una: el bucle hacía dos consultas por reserva con
      // el bloqueo del aula tomado, así que dar de baja un aula muy reservada
      // mantenía esa transacción abierta más de lo necesario.
      await Reserva.update(
        { estado: 'cancelada' },
        { where: { id: { [Op.in]: reservasFuturas.map((r) => r.id) } }, transaction }
      );

      await registrarAccionesEnLote(
        reservasFuturas.map((r) => ({
          idEntidad: r.id,
          usuarioId: usuarioIdAdmin,
          accion: 'cancelada',
          valorAnterior: { estado: r.estado },
          valorNuevo: { estado: 'cancelada', motivo: `Baja del aula: ${motivo}` }
        })),
        { transaction }
      );
    }

    const valorAnterior = { activa: aula.activa };
    aula.activa = false;
    await aula.save({ transaction });

    await registrarAccionAula(
      aula.id,
      usuarioIdAdmin,
      'desactivacion',
      valorAnterior,
      { activa: false, motivo: motivo || null, reservasCanceladas: reservasFuturas.length },
      { transaction }
    );

    return {
      aula,
      reservasCanceladas: reservasFuturas.length
    };
  });
};

export const reactivarAula = async (id, usuarioIdAdmin) => {
  return await sequelize.transaction(async (transaction) => {
    const aula = await Aula.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!aula) {
      const error = new Error('El aula solicitada no existe');
      error.status = 404;
      throw error;
    }

    if (aula.activa) {
      return aula;
    }

    const valorAnterior = { activa: false };
    aula.activa = true;
    await aula.save({ transaction });

    await registrarAccionAula(
      aula.id,
      usuarioIdAdmin,
      'reactivacion',
      valorAnterior,
      { activa: true },
      { transaction }
    );

    return aula;
  });
};
