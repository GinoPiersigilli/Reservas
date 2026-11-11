// services/aulas.service.js
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Aula from '../models/aula.model.js';
import Reserva from '../models/reserva.model.js';
import { registrarAccion, registrarAccionAula } from './historial.services.js';
import { esFechaValida, hoyArgentina } from '../utils/fecha.js';

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

    if (datos.nombre !== undefined) {
      const nombreTrim = datos.nombre.trim();
      const duplicada = await Aula.findOne({
        where: {
          id: { [Op.ne]: id },
          [Op.and]: sequelize.where(sequelize.fn('LOWER', sequelize.col('nombre')), nombreTrim.toLowerCase())
        },
        transaction
      });

      if (duplicada) {
        const error = new Error('Ya existe un aula con ese nombre');
        error.status = 409;
        throw error;
      }
    }

    if (datos.capacidad !== undefined) {
      const nuevaCapacidad = Number(datos.capacidad);
      const hoy = hoyArgentina();
      const reservasFuturas = await Reserva.findAll({
        where: {
          aulaId: id,
          fecha: { [Op.gte]: hoy },
          estado: { [Op.in]: ['pendiente', 'aprobada'] }
        },
        attributes: ['id', 'cantidadPersonas', 'fecha', 'horaInicio'],
        transaction
      });

      const maxPersonas = reservasFuturas.reduce((max, r) => Math.max(max, r.cantidadPersonas), 0);
      if (nuevaCapacidad < maxPersonas) {
        const error = new Error('No se puede reducir la capacidad por debajo de las reservas futuras existentes');
        error.status = 409;
        error.capacidadMaximaRequerida = maxPersonas;
        error.detalle = {
          capacidadSolicitada: nuevaCapacidad,
          capacidadMaximaRequerida: maxPersonas,
          reservasAfectadas: reservasFuturas.filter((r) => r.cantidadPersonas > nuevaCapacidad).length
        };
        throw error;
      }
    }

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

    await registrarAccionAula(
      aula.id,
      usuarioIdAdmin,
      'edicion',
      valorAnterior,
      valorNuevo,
      { transaction }
    );

    return aula;
  });
};

export const desactivarAula = async (id, { cancelarReservasFuturas, motivo } = {}, usuarioIdAdmin) => {
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

    const hoy = hoyArgentina();
    const reservasFuturas = await Reserva.findAll({
      where: {
        aulaId: id,
        fecha: { [Op.gte]: hoy },
        estado: { [Op.in]: ['pendiente', 'aprobada'] }
      },
      transaction
    });

    if (reservasFuturas.length > 0 && !cancelarReservasFuturas) {
      const error = new Error('El aula tiene reservas futuras activas');
      error.status = 409;
      error.reservasAfectadas = reservasFuturas.length;
      throw error;
    }

    if (reservasFuturas.length > 0 && cancelarReservasFuturas) {
      for (const r of reservasFuturas) {
        const estadoAnterior = r.estado;
        r.estado = 'cancelada';
        await r.save({ transaction });

        await registrarAccion(
          r.id,
          usuarioIdAdmin,
          'cancelada',
          { estado: estadoAnterior },
          { estado: 'cancelada', motivo: `Baja del aula: ${motivo}` },
          { transaction }
        );
      }
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
