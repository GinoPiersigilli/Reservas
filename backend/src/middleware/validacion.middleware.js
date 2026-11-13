import { z } from 'zod';
import { esFechaValida, esFechaPasada, esHorarioPasado } from '../utils/fecha.js';

export const validar =
  (schema, target = 'body') =>
  (req, res, next) => {
    if (schema && (schema.params || schema.query || schema.body)) {
      const targets = ['params', 'query', 'body'];
      for (const t of targets) {
        if (schema[t]) {
          const result = schema[t].safeParse(req[t]);
          if (!result.success) {
            const firstIssue = result.error.issues[0];
            return res.status(400).json({ error: firstIssue.message });
          }
          req[t] = result.data;
        }
      }
      return next();
    }

    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({ error: firstIssue.message });
    }
    req[target] = result.data;
    return next();
  };

export const cadenaVaciaAUndefined = (valor) => {
  if (valor === null || (typeof valor === 'string' && valor.trim() === '')) {
    return undefined;
  }
  return valor;
};

export const opcional = (schema) => z.preprocess(cadenaVaciaAUndefined, schema.optional());

export const loginSchema = z.object({
  email: z
    .string({ message: 'Email y contraseña son obligatorios' })
    .trim()
    .min(1, 'Email y contraseña son obligatorios')
    .email('El formato del email es inválido'),
  password: z
    .string({ message: 'Email y contraseña son obligatorios' })
    .min(1, 'Email y contraseña son obligatorios')
});

export const idParamSchema = z.object({
  id: z.coerce
    .number({ message: 'El id debe ser un número entero mayor a 0' })
    .int('El id debe ser un número entero mayor a 0')
    .positive('El id debe ser un número entero mayor a 0')
});

export const queryAulasSchema = z.object({
  incluirInactivas: opcional(
    z.preprocess((val) => val === true || val === 'true' || val === 1 || val === '1', z.boolean())
  )
});

export const crearAulaSchema = z.object({
  nombre: z
    .string({ message: 'El nombre del aula es obligatorio' })
    .trim()
    .min(1, 'El nombre del aula es obligatorio')
    .max(100, 'El nombre no puede superar los 100 caracteres'),
  ubicacion: z
    .string({ message: 'La ubicación del aula es obligatoria' })
    .trim()
    .min(1, 'La ubicación del aula es obligatoria')
    .max(120, 'La ubicación no puede superar los 120 caracteres'),
  capacidad: z.coerce
    .number({ message: 'La capacidad debe ser un número entero entre 1 y 1000' })
    .int('La capacidad debe ser un número entero entre 1 y 1000')
    .min(1, 'La capacidad debe ser un número entero entre 1 y 1000')
    .max(1000, 'La capacidad debe ser un número entero entre 1 y 1000'),
  recursos: opcional(z.string().max(255, 'Los recursos no pueden superar los 255 caracteres'))
});

export const editarAulaSchema = z
  .object({
    nombre: opcional(
      z
        .string()
        .trim()
        .min(1, 'El nombre del aula no puede estar vacío')
        .max(100, 'El nombre no puede superar los 100 caracteres')
    ),
    ubicacion: opcional(
      z
        .string()
        .trim()
        .min(1, 'La ubicación no puede estar vacía')
        .max(120, 'La ubicación no puede superar los 120 caracteres')
    ),
    capacidad: opcional(
      z.coerce
        .number({ message: 'La capacidad debe ser un número entero entre 1 y 1000' })
        .int('La capacidad debe ser un número entero entre 1 y 1000')
        .min(1, 'La capacidad debe ser un número entero entre 1 y 1000')
        .max(1000, 'La capacidad debe ser un número entero entre 1 y 1000')
    ),
    recursos: opcional(z.string().max(255, 'Los recursos no pueden superar los 255 caracteres'))
  })
  .refine(
    (data) =>
      data.nombre !== undefined ||
      data.ubicacion !== undefined ||
      data.capacidad !== undefined ||
      data.recursos !== undefined,
    { message: 'Debe enviar al menos un campo para actualizar' }
  );

export const desactivarAulaSchema = z
  .object({
    cancelarReservasFuturas: opcional(
      z.preprocess((val) => val === true || val === 'true' || val === 1 || val === '1', z.boolean())
    ),
    motivo: opcional(z.string().max(255, 'El motivo no puede superar los 255 caracteres'))
  })
  .superRefine((data, ctx) => {
    if (data.cancelarReservasFuturas && (!data.motivo || data.motivo.trim().length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['motivo'],
        message: 'Debe ingresar un motivo para cancelar las reservas futuras'
      });
    }
  });

export const queryReservasSchema = z.object({
  page: opcional(
    z.coerce
      .number({ message: 'La página debe ser un número entero mayor a 0' })
      .int('La página debe ser un número entero mayor a 0')
      .min(1, 'La página debe ser un número entero mayor a 0')
  ),
  limit: opcional(
    z.coerce
      .number({ message: 'El límite debe ser un número entero mayor a 0' })
      .int('El límite debe ser un número entero mayor a 0')
      .min(1, 'El límite debe ser un número entero mayor a 0')
  ).transform((val) => (val !== undefined ? Math.min(val, 100) : val)),
  sortBy: opcional(z.string()).transform((val) => {
    if (!val) return 'createdAt';
    return ['createdAt', 'fecha', 'horaInicio', 'estado', 'aulaId', 'id'].includes(val)
      ? val
      : 'createdAt';
  }),
  order: opcional(z.string()).transform((val) => {
    if (!val) return 'DESC';
    const upper = val.toUpperCase();
    return upper === 'ASC' || upper === 'DESC' ? upper : 'DESC';
  }),
  fecha: opcional(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener un formato válido YYYY-MM-DD')
      .refine(esFechaValida, 'La fecha debe tener un formato válido YYYY-MM-DD')
  ),
  estado: opcional(
    z.enum(['pendiente', 'aprobada', 'rechazada', 'cancelada'], {
      message: 'El estado no es válido'
    })
  ),
  aulaId: opcional(
    z.coerce
      .number({ message: 'El aulaId debe ser un número entero válido' })
      .int('El aulaId debe ser un número entero válido')
      .positive('El aulaId debe ser un número entero válido')
  ),
  q: opcional(z.string().max(255, 'La búsqueda no puede superar los 255 caracteres'))
});

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const estaVacio = (valor) =>
  valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

const esEntero = (valor) => {
  if (typeof valor === 'number') return Number.isInteger(valor);
  if (typeof valor === 'string' && /^-?\d+$/.test(valor.trim())) return true;
  return false;
};

const CAMPOS_RESERVA = ['aulaId', 'fecha', 'horaInicio', 'horaFin', 'cantidadPersonas', 'motivo'];

const agregarProblema = (ctx, campo, message) => {
  ctx.addIssue({ code: 'custom', path: [campo], message });
};

const esHoraValida = (valor) => typeof valor === 'string' && HORA_REGEX.test(valor);

// Validadores por campo, compartidos por el alta y la edición de reservas.
const VALIDADORES_RESERVA = {
  aulaId: (valor, ctx) => {
    if (!esEntero(valor) || Number(valor) <= 0) {
      agregarProblema(ctx, 'aulaId', 'El aulaId debe ser un número entero válido');
    }
  },
  fecha: (valor, ctx) => {
    if (!esFechaValida(valor)) {
      agregarProblema(ctx, 'fecha', 'La fecha debe tener un formato válido YYYY-MM-DD');
    } else if (esFechaPasada(valor)) {
      agregarProblema(ctx, 'fecha', 'No se permiten reservas en una fecha pasada');
    }
  },
  horaInicio: (valor, ctx) => {
    if (!esHoraValida(valor)) {
      agregarProblema(ctx, 'horaInicio', 'La hora de inicio debe tener el formato HH:MM');
    }
  },
  horaFin: (valor, ctx) => {
    if (!esHoraValida(valor)) {
      agregarProblema(ctx, 'horaFin', 'La hora de fin debe tener el formato HH:MM');
    }
  },
  cantidadPersonas: (valor, ctx) => {
    if (!esEntero(valor) || Number(valor) <= 0) {
      agregarProblema(
        ctx,
        'cantidadPersonas',
        'La cantidad de personas debe ser un número entero mayor a 0'
      );
    }
  },
  motivo: (valor, ctx) => {
    if (typeof valor !== 'string' || valor.trim().length === 0) {
      agregarProblema(ctx, 'motivo', 'El motivo no puede estar vacío');
    } else if (valor.length > 255) {
      agregarProblema(ctx, 'motivo', 'El motivo no puede superar los 255 caracteres');
    }
  }
};

/** Solo tiene sentido comprobarlo cuando fecha y hora de inicio son válidas. */
const validarHorarioNoTranscurrido = (data, ctx) => {
  const puedeCompararse =
    data.fecha !== undefined &&
    data.horaInicio !== undefined &&
    esFechaValida(data.fecha) &&
    !esFechaPasada(data.fecha) &&
    esHoraValida(data.horaInicio);

  if (puedeCompararse && esHorarioPasado(data.fecha, data.horaInicio)) {
    agregarProblema(
      ctx,
      'horaInicio',
      'No se pueden realizar reservas en horarios que ya han transcurrido'
    );
  }
};

/** Aplica los validadores a los campos presentes, en un orden estable. */
const validarCamposPresentes = (data, ctx) => {
  for (const campo of ['aulaId', 'fecha', 'horaInicio', 'horaFin']) {
    if (data[campo] !== undefined) VALIDADORES_RESERVA[campo](data[campo], ctx);
  }

  validarHorarioNoTranscurrido(data, ctx);

  for (const campo of ['cantidadPersonas', 'motivo']) {
    if (data[campo] !== undefined) VALIDADORES_RESERVA[campo](data[campo], ctx);
  }
};

/** Normaliza a número los campos numéricos que llegan como texto. */
const normalizarNumeros = (data) => {
  const resultado = { ...data };
  for (const campo of ['aulaId', 'cantidadPersonas']) {
    if (resultado[campo] !== undefined && esEntero(resultado[campo])) {
      resultado[campo] = Number(resultado[campo]);
    }
  }
  return resultado;
};

export const crearReservaBodySchema = z
  .object({
    aulaId: z.unknown().optional(),
    fecha: z.unknown().optional(),
    horaInicio: z.unknown().optional(),
    horaFin: z.unknown().optional(),
    cantidadPersonas: z.unknown().optional(),
    motivo: z.unknown().optional()
  })
  .superRefine((data, ctx) => {
    const faltantes = CAMPOS_RESERVA.filter((campo) => estaVacio(data[campo]));

    if (faltantes.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `Faltan campos obligatorios: ${faltantes.join(', ')}`
      });
      return;
    }

    validarCamposPresentes(data, ctx);
  })
  .transform(normalizarNumeros);

export const editarReservaBodySchema = z
  .object({
    aulaId: opcional(z.unknown()),
    fecha: opcional(z.unknown()),
    horaInicio: opcional(z.unknown()),
    horaFin: opcional(z.unknown()),
    cantidadPersonas: opcional(z.unknown()),
    motivo: opcional(z.unknown())
  })
  .superRefine(validarCamposPresentes)
  .transform(normalizarNumeros);

export const validarCrearReserva = validar(crearReservaBodySchema);
export const validarEditarReserva = validar(editarReservaBodySchema);

export const validarLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email y contraseña son obligatorios'
    });
  }

  next();
};

export const validarRegistro = (req, res, next) => {
  const { nombre, email, password } = req.body;
  const faltantes = [];

  if (!nombre) faltantes.push('nombre');
  if (!email) faltantes.push('email');
  if (!password) faltantes.push('password');

  if (faltantes.length > 0) {
    return res.status(400).json({
      error: `Faltan campos obligatorios: ${faltantes.join(', ')}`
    });
  }

  next();
};
