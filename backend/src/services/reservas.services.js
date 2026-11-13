// services/reservas.service.js
import Reserva from '../models/reserva.model.js';
import HistorialReserva from '../models/historial.model.js';
import sequelize from '../config/database.js';
import Aula from '../models/aula.model.js';
import Usuario from '../models/usuario.model.js';
import IdempotencyKey from '../models/idempotencyKey.model.js';
import { Op } from 'sequelize'; // Operadores de Sequelize para hacer consultas complejas
import { registrarAccion } from './historial.services.js';
import { esUuidValido, calcularHashCuerpo } from './idempotencia.services.js';
import env from '../config/env.js';
import { hoyArgentina, horaActualArgentina, esHorarioPasado } from '../utils/fecha.js';

const WORK_HOUR_START = env.WORK_HOUR_START;
const WORK_HOUR_END = env.WORK_HOUR_END;
const SORT_BY_PERMITIDOS = ['createdAt', 'fecha', 'horaInicio', 'estado', 'aulaId', 'id'];

const esErrorSolapamiento = (err) =>
  err?.name === 'SequelizeExclusionConstraintError' ||
  err?.parent?.code === '23P01' ||
  err?.original?.code === '23P01';

const VENCIMIENTO_CLAVE_MS = 24 * 60 * 60 * 1000;

const errorDeNegocio = (mensaje, status, extra = {}) => {
  const error = new Error(mensaje);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

/** Reglas de horario que no dependen de la base de datos. */
const validarHorarioSolicitado = ({ fecha, horaInicio, horaFin }) => {
  if (horaInicio >= horaFin) {
    throw errorDeNegocio('La hora de inicio debe ser menor a la hora de fin', 400);
  }
  if (horaInicio < WORK_HOUR_START || horaFin > WORK_HOUR_END) {
    throw errorDeNegocio(
      `Las reservas solo se permiten entre las ${WORK_HOUR_START} y las ${WORK_HOUR_END}`,
      400
    );
  }
  if (esHorarioPasado(fecha, horaInicio)) {
    throw errorDeNegocio('No se pueden realizar reservas en horarios que ya han transcurrido', 400);
  }
};

const buscarClaveVigente = (usuarioId, clave) =>
  IdempotencyKey.findOne({
    where: { usuarioId, clave, expiresAt: { [Op.gt]: new Date() } }
  });

/**
 * Respuesta ya emitida para esta clave. Si el cuerpo no coincide, la clave se
 * está reutilizando para otra operación y eso es un error del cliente (422).
 */
const respuestaAlmacenada = (registro, cuerpoHash) => {
  if (registro.cuerpoHash !== cuerpoHash) {
    throw errorDeNegocio('La clave de idempotencia ya fue utilizada con un cuerpo diferente', 422);
  }
  return { replay: true, status: registro.estadoRespuesta, datos: registro.cuerpoRespuesta };
};

/**
 * Valida la clave de idempotencia y devuelve la respuesta previa si esta
 * operación ya se había ejecutado.
 */
const resolverIdempotencia = async ({ idempotencyKey, usuarioId, cuerpoHash }) => {
  if (!esUuidValido(idempotencyKey)) {
    throw errorDeNegocio('El encabezado Idempotency-Key debe ser un UUID válido', 400);
  }

  const clavePrevia = await buscarClaveVigente(usuarioId, idempotencyKey);
  return clavePrevia ? respuestaAlmacenada(clavePrevia, cuerpoHash) : null;
};

/**
 * Guarda la respuesta asociada a la clave en la misma transacción que la
 * reserva, de modo que ambas se confirmen o se descarten juntas. Una clave ya
 * vencida se renueva; una vigente nunca se sobreescribe.
 */
const registrarClaveIdempotencia = async (
  { usuarioId, clave, cuerpoHash, reserva },
  transaction
) => {
  await sequelize.query(
    `
    INSERT INTO idempotency_keys ("usuarioId", "clave", "cuerpoHash", "estadoRespuesta", "cuerpoRespuesta", "createdAt", "expiresAt")
    VALUES (:usuarioId, :clave, :cuerpoHash, :estadoRespuesta, :cuerpoRespuesta::jsonb, NOW(), :expiresAt)
    ON CONFLICT ("usuarioId", "clave") DO UPDATE SET
      "cuerpoHash" = EXCLUDED."cuerpoHash",
      "estadoRespuesta" = EXCLUDED."estadoRespuesta",
      "cuerpoRespuesta" = EXCLUDED."cuerpoRespuesta",
      "createdAt" = EXCLUDED."createdAt",
      "expiresAt" = EXCLUDED."expiresAt"
    WHERE idempotency_keys."expiresAt" < NOW()
  `,
    {
      replacements: {
        usuarioId,
        clave,
        cuerpoHash,
        estadoRespuesta: 201,
        cuerpoRespuesta: JSON.stringify(reserva.toJSON ? reserva.toJSON() : reserva),
        expiresAt: new Date(Date.now() + VENCIMIENTO_CLAVE_MS)
      },
      transaction
    }
  );
};

/** Comprobaciones que requieren leer la base dentro de la transacción. */
const verificarAulaYDisponibilidad = async (datos, transaction) => {
  const { aulaId, fecha, horaInicio, horaFin, cantidadPersonas } = datos;

  // Bloqueo compartido sobre el aula para evitar carreras con su baja
  const aula = await Aula.findByPk(aulaId, { transaction, lock: transaction.LOCK.SHARE });
  if (!aula) {
    throw errorDeNegocio('El aula solicitada no existe', 404);
  }
  if (!aula.activa) {
    throw errorDeNegocio('El aula no está activa para nuevas reservas', 400);
  }
  if (cantidadPersonas > aula.capacidad) {
    throw errorDeNegocio('La cantidad de personas supera la capacidad del aula', 400);
  }

  // Chequeo previo amable; la garantía real la da la restricción de exclusión
  const reservaExistente = await Reserva.findOne({
    where: {
      aulaId,
      fecha,
      estado: { [Op.in]: ['pendiente', 'aprobada'] },
      [Op.and]: [{ horaInicio: { [Op.lt]: horaFin } }, { horaFin: { [Op.gt]: horaInicio } }]
    },
    transaction
  });

  if (reservaExistente) {
    throw errorDeNegocio('El aula ya está reservada en ese horario', 400, { esSolapamiento: true });
  }
};

/**
 * Tras un conflicto, busca la respuesta que pudo haber dejado otro pedido
 * concurrente con la misma clave. Los reintentos son cortos y acotados: solo
 * cubren la ventana entre el conflicto y el commit del pedido que ganó.
 */
const recuperarRespuestaDeCarrera = async ({ usuarioId, idempotencyKey, cuerpoHash }) => {
  const ESPERAS_MS = [0, 20, 40, 80];

  for (const espera of ESPERAS_MS) {
    if (espera > 0) {
      await new Promise((r) => setTimeout(r, espera));
    }
    const claveCometida = await buscarClaveVigente(usuarioId, idempotencyKey);
    if (claveCometida) {
      return respuestaAlmacenada(claveCometida, cuerpoHash);
    }
  }

  return null;
};

/** Solo un conflicto de solapamiento o de unicidad puede deberse a esa carrera. */
const puedeSerCarreraDeIdempotencia = (err) => {
  const pgCode = err?.parent?.code || err?.original?.code;
  return err?.esSolapamiento === true || pgCode === '23P01' || pgCode === '23505';
};

// Función para crear una nueva reserva
export const crearNuevaReserva = async (datosReserva, opciones = {}) => {
  const { aulaId, usuarioId, fecha, horaInicio, horaFin, cantidadPersonas, motivo } = datosReserva;
  const { idempotencyKey, cuerpoOriginal } = opciones;
  const usaIdempotencia = idempotencyKey !== undefined && idempotencyKey !== null;

  // 1. Idempotencia: si esta misma operación ya se ejecutó, se repite su respuesta
  let cuerpoHash = null;
  if (usaIdempotencia) {
    cuerpoHash = calcularHashCuerpo(
      cuerpoOriginal || { aulaId, fecha, horaInicio, horaFin, cantidadPersonas, motivo }
    );
    const respuestaPrevia = await resolverIdempotencia({ idempotencyKey, usuarioId, cuerpoHash });
    if (respuestaPrevia) return respuestaPrevia;
  }

  // 2. Reglas de horario
  validarHorarioSolicitado({ fecha, horaInicio, horaFin });

  try {
    return await sequelize.transaction(async (transaction) => {
      // 3. Aula activa, capacidad y disponibilidad
      await verificarAulaYDisponibilidad(datosReserva, transaction);

      // 4. Reserva e historial en la misma transacción
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

      await registrarAccion(
        nuevaReserva.id,
        usuarioId,
        'creacion',
        null,
        { estado: 'pendiente' },
        { transaction }
      );

      if (!usaIdempotencia) return nuevaReserva;

      // 5. La clave se confirma junto con la reserva
      await registrarClaveIdempotencia(
        { usuarioId, clave: idempotencyKey, cuerpoHash, reserva: nuevaReserva },
        transaction
      );

      return { replay: false, status: 201, datos: nuevaReserva };
    });
  } catch (err) {
    if (usaIdempotencia && puedeSerCarreraDeIdempotencia(err)) {
      const respuestaDeOtroPedido = await recuperarRespuestaDeCarrera({
        usuarioId,
        idempotencyKey,
        cuerpoHash
      });
      if (respuestaDeOtroPedido) return respuestaDeOtroPedido;
    }

    if (esErrorSolapamiento(err)) {
      throw errorDeNegocio('El aula ya está reservada en ese horario', 400);
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
      const error = new Error('La reserva no existe');
      error.status = 404;
      throw error;
    }

    // 2. Validamos el flujo de estados
    // Solo se permite pasar de 'pendiente' a 'aprobada' o 'rechazada'[cite: 67].
    if (reservaActual.estado !== 'pendiente') {
      const error = new Error('Solo se pueden aprobar reservas pendientes');
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
      const error = new Error('La reserva no existe');
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
      const error = new Error('No tienes permiso para cancelar esta reserva');
      error.status = 403;
      throw error;
    }

    // 3. Validación de estado
    // Solo se pueden cancelar reservas pendientes o aprobadas
    if (reservaActual.estado !== 'pendiente' && reservaActual.estado !== 'aprobada') {
      const error = new Error('Solo se pueden cancelar reservas pendientes o aprobadas');
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
/** Filtros de búsqueda; un usuario común solo ve sus propias reservas. */
const construirFiltros = ({ fecha, estado, aulaId, q }, usuarioActual, esAdmin) => {
  const where = {};

  if (usuarioActual && !esAdmin) where.usuarioId = usuarioActual.id;
  if (fecha) where.fecha = fecha;
  if (estado) where.estado = estado;
  if (aulaId) where.aulaId = aulaId;
  if (q) where.motivo = { [Op.like]: `%${q}%` };

  return where;
};

/** Paginación acotada: página mínima 1 y hasta 100 filas por página. */
const resolverPaginacion = (page, limit) => {
  const paginaPedida = parseInt(page, 10);
  const limitePedido = parseInt(limit, 10);

  const pagina = Number.isNaN(paginaPedida) || paginaPedida < 1 ? 1 : paginaPedida;
  const porPagina =
    Number.isNaN(limitePedido) || limitePedido < 1 ? 10 : Math.min(limitePedido, 100);

  return { pagina, porPagina };
};

/** Solo se aceptan columnas y direcciones de una lista blanca. */
const resolverOrden = (sortBy, order) => {
  const columna = SORT_BY_PERMITIDOS.includes(sortBy) ? sortBy : 'createdAt';
  const pedida = typeof order === 'string' ? order.toUpperCase() : '';
  const direccion = pedida === 'ASC' || pedida === 'DESC' ? pedida : 'DESC';

  return [[columna, direccion]];
};

/** Los datos del solicitante solo se incluyen para administradores. */
const includeSolicitante = (esAdmin) =>
  esAdmin ? [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre', 'email'] }] : [];

export const obtenerReservas = async (filtros = {}, usuarioParam) => {
  const { page, limit, sortBy, order, usuario } = filtros;
  const usuarioActual = usuarioParam || usuario;
  const esAdmin = Boolean(usuarioActual && usuarioActual.rol === 'admin');

  const { pagina, porPagina } = resolverPaginacion(page, limit);

  const { count, rows } = await Reserva.findAndCountAll({
    where: construirFiltros(filtros, usuarioActual, esAdmin),
    include: includeSolicitante(esAdmin),
    distinct: true,
    order: resolverOrden(sortBy, order),
    limit: porPagina,
    offset: (pagina - 1) * porPagina
  });

  return { total: count, pagina, porPagina, datos: rows };
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

  // El historial nombra a quien hizo cada cambio: un registro de auditoría que
  // dice «Usuario #4» no sirve para auditar. Solo el nombre, nunca el correo,
  // porque lo ve también quien es dueño de la reserva.
  const historial = await HistorialReserva.findAll({
    where: { reservaId },
    include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] }],
    order: [['fechaHora', 'DESC']]
  });

  return historial;
};

// ==========================================
// EDITAR RESERVA
// ==========================================
const CAMPOS_EDITABLES = ['aulaId', 'fecha', 'horaInicio', 'horaFin', 'cantidadPersonas', 'motivo'];

/** Valores resultantes de aplicar los cambios pedidos sobre la reserva actual. */
const combinarCambios = (reserva, datos) => {
  const resultado = {};
  for (const campo of CAMPOS_EDITABLES) {
    resultado[campo] = datos[campo] !== undefined ? datos[campo] : reserva[campo];
  }
  return resultado;
};

const validarDatosEdicion = (valores) => {
  if (
    !Number.isInteger(Number(valores.cantidadPersonas)) ||
    Number(valores.cantidadPersonas) <= 0
  ) {
    throw errorDeNegocio('La cantidad de personas debe ser un número entero mayor a 0', 400);
  }
  if (typeof valores.motivo !== 'string' || valores.motivo.trim().length === 0) {
    throw errorDeNegocio('El motivo no puede estar vacío', 400);
  }

  validarHorarioSolicitado({
    fecha: valores.fecha,
    horaInicio: valores.horaInicio,
    horaFin: valores.horaFin
  });
};

/** Igual que en el alta, pero ignorando la propia reserva al buscar conflictos. */
const verificarAulaYDisponibilidadAlEditar = async (reservaId, valores, transaction) => {
  const aula = await Aula.findByPk(valores.aulaId, { transaction, lock: transaction.LOCK.SHARE });
  if (!aula) {
    throw errorDeNegocio('El aula solicitada no existe', 404);
  }
  if (!aula.activa) {
    throw errorDeNegocio('El aula no está activa para nuevas reservas', 400);
  }
  if (valores.cantidadPersonas > aula.capacidad) {
    throw errorDeNegocio('La cantidad de personas supera la capacidad del aula', 400);
  }

  const conflicto = await Reserva.findOne({
    where: {
      id: { [Op.ne]: reservaId },
      aulaId: valores.aulaId,
      fecha: valores.fecha,
      estado: { [Op.in]: ['pendiente', 'aprobada'] },
      [Op.and]: [
        { horaInicio: { [Op.lt]: valores.horaFin } },
        { horaFin: { [Op.gt]: valores.horaInicio } }
      ]
    },
    transaction
  });

  if (conflicto) {
    throw errorDeNegocio('El aula ya está reservada en ese horario', 400);
  }
};

const datosParaHistorial = (reserva) => ({
  fecha: reserva.fecha,
  horaInicio: reserva.horaInicio,
  horaFin: reserva.horaFin,
  cantidadPersonas: reserva.cantidadPersonas,
  motivo: reserva.motivo
});

export const editarReserva = async (reservaId, datos, usuarioIdAdmin) => {
  try {
    return await sequelize.transaction(async (transaction) => {
      const reserva = await Reserva.findByPk(reservaId, { transaction });

      if (!reserva) {
        throw errorDeNegocio('La reserva no existe', 404);
      }
      if (reserva.estado === 'cancelada' || reserva.estado === 'rechazada') {
        throw errorDeNegocio('No se puede editar una reserva cancelada o rechazada', 400);
      }

      const valores = combinarCambios(reserva, datos);
      validarDatosEdicion(valores);
      await verificarAulaYDisponibilidadAlEditar(reservaId, valores, transaction);

      const valorAnterior = datosParaHistorial(reserva);

      for (const campo of CAMPOS_EDITABLES) {
        if (datos[campo] !== undefined) reserva[campo] = datos[campo];
      }

      await reserva.save({ transaction });

      await registrarAccion(
        reservaId,
        usuarioIdAdmin,
        'edicion',
        valorAnterior,
        datosParaHistorial(reserva),
        { transaction }
      );

      return reserva;
    });
  } catch (err) {
    if (esErrorSolapamiento(err)) {
      throw errorDeNegocio('El aula ya está reservada en ese horario', 400);
    }
    throw err;
  }
};

// ==========================================
// RESUMEN ADMINISTRATIVO
// ==========================================
const ESTADOS_POSIBLES = ['aprobada', 'pendiente', 'rechazada', 'cancelada'];
const HORAS_OPERATIVAS_POR_DIA = 14; // franja operativa entre 08:00 y 22:00

const totalDeFila = (item) => parseInt(item.dataValues?.total || item.total, 10) || 0;

/** Consultas agregadas que alimentan el panel administrativo. */
const consultarAgregadosResumen = (fechaHoy, horaAhora, esAdmin) =>
  Promise.all([
    // Total por estado
    Reserva.findAll({
      attributes: ['estado', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group: ['estado']
    }),
    // Reservas por aula (las más usadas)
    Reserva.findAll({
      attributes: ['aulaId', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group: ['aulaId'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5
    }),
    // Próximas reservas del día
    Reserva.findAll({
      where: {
        estado: { [Op.in]: ['pendiente', 'aprobada'] },
        fecha: fechaHoy,
        horaInicio: { [Op.gte]: horaAhora }
      },
      include: includeSolicitante(esAdmin),
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

/** Cantidad y porcentaje de reservas en cada estado. */
const calcularDistribucionEstados = (porEstado) => {
  const totalReservas = porEstado.reduce((acc, fila) => acc + totalDeFila(fila), 0);
  const mapaEstados = new Map(porEstado.map((item) => [item.estado, totalDeFila(item)]));

  const distribucionEstados = ESTADOS_POSIBLES.map((estado) => {
    const cantidad = mapaEstados.get(estado) || 0;
    return {
      estado,
      cantidad,
      porcentaje: totalReservas > 0 ? Math.round((cantidad / totalReservas) * 100) : 0
    };
  });

  return { totalReservas, distribucionEstados };
};

/** Primer y último día del mes de la fecha indicada, más su cantidad de días. */
const limitesDelMes = (fechaHoy) => {
  const [anio, mes] = fechaHoy.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

  return {
    inicioMes: `${fechaHoy.slice(0, 7)}-01`,
    finMes: `${fechaHoy.slice(0, 7)}-${String(ultimoDia).padStart(2, '0')}`,
    ultimoDia
  };
};

const horasEntre = (horaInicio, horaFin) => {
  const [hI, mI] = String(horaInicio).split(':').map(Number);
  const [hF, mF] = String(horaFin).split(':').map(Number);
  return Math.max(0, (hF * 60 + mF - (hI * 60 + mI)) / 60);
};

/** Horas reservadas por aula en el mes actual sobre las horas operativas. */
const calcularTasaOcupacion = async (fechaHoy, aulas) => {
  const { inicioMes, finMes, ultimoDia } = limitesDelMes(fechaHoy);

  const reservasMes = await Reserva.findAll({
    where: {
      estado: { [Op.in]: ['pendiente', 'aprobada'] },
      fecha: { [Op.between]: [inicioMes, finMes] }
    },
    attributes: ['aulaId', 'horaInicio', 'horaFin']
  });

  const horasPorAula = new Map();
  for (const reserva of reservasMes) {
    const acumuladas = horasPorAula.get(reserva.aulaId) || 0;
    horasPorAula.set(reserva.aulaId, acumuladas + horasEntre(reserva.horaInicio, reserva.horaFin));
  }

  const horasOperativasMes = ultimoDia * HORAS_OPERATIVAS_POR_DIA;

  return aulas.map((aula) => {
    const horasOcupadas = horasPorAula.get(aula.id) || 0;
    return {
      aulaId: aula.id,
      nombre: aula.nombre,
      capacidad: aula.capacidad,
      ubicacion: aula.ubicacion,
      horasOcupadas: Number(horasOcupadas.toFixed(1)),
      horasDisponibles: horasOperativasMes,
      tasaOcupacion:
        horasOperativasMes > 0
          ? Math.min(100, Math.round((horasOcupadas / horasOperativasMes) * 100))
          : 0
    };
  });
};

/** Aulas ordenadas por horas ocupadas y, a igualdad, por cantidad de reservas. */
const calcularAulasMayorDemanda = (tasaOcupacionAulas, porAula) => {
  const totalPorAula = new Map(porAula.map((item) => [item.aulaId, totalDeFila(item)]));

  return [...tasaOcupacionAulas]
    .map((item) => ({ ...item, totalReservas: totalPorAula.get(item.aulaId) || 0 }))
    .sort((a, b) => b.horasOcupadas - a.horasOcupadas || b.totalReservas - a.totalReservas)
    .slice(0, 5);
};

export const obtenerResumen = async (usuario) => {
  const fechaHoy = hoyArgentina();
  const esAdmin = Boolean(usuario && usuario.rol === 'admin');

  const [porEstado, porAula, proximasHoy, todasAulas] = await consultarAgregadosResumen(
    fechaHoy,
    horaActualArgentina(),
    esAdmin
  );

  const { totalReservas, distribucionEstados } = calcularDistribucionEstados(porEstado);
  const tasaOcupacionAulas = await calcularTasaOcupacion(fechaHoy, todasAulas);

  return {
    porEstado,
    porAula,
    proximasHoy,
    distribucionEstados,
    tasaOcupacionAulas,
    aulasMayorDemanda: calcularAulasMayorDemanda(tasaOcupacionAulas, porAula),
    totalReservas
  };
};
