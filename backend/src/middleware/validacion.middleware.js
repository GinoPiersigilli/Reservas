import { z } from 'zod';
import { esFechaValida, esFechaPasada } from '../utils/fecha.js';

export const validar = (schema, target = 'body') => (req, res, next) => {
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

export const loginSchema = z.object({
  email: z.string({ message: 'Email y contraseña son obligatorios' })
    .trim()
    .min(1, 'Email y contraseña son obligatorios')
    .email('El formato del email es inválido'),
  password: z.string({ message: 'Email y contraseña son obligatorios' })
    .min(1, 'Email y contraseña son obligatorios')
});

export const idParamSchema = z.object({
  id: z.coerce.number({ message: 'El id debe ser un número entero mayor a 0' })
    .int('El id debe ser un número entero mayor a 0')
    .positive('El id debe ser un número entero mayor a 0')
});

export const queryReservasSchema = z.object({
  page: z.coerce.number({ message: 'La página debe ser un número entero mayor a 0' })
    .int('La página debe ser un número entero mayor a 0')
    .min(1, 'La página debe ser un número entero mayor a 0')
    .optional(),
  limit: z.coerce.number({ message: 'El límite debe ser un número entero mayor a 0' })
    .int('El límite debe ser un número entero mayor a 0')
    .min(1, 'El límite debe ser un número entero mayor a 0')
    .optional()
    .transform((val) => (val !== undefined ? Math.min(val, 100) : val)),
  sortBy: z.string().optional().transform((val) => {
    if (!val) return undefined;
    return ['createdAt', 'fecha', 'horaInicio', 'estado', 'aulaId', 'id'].includes(val) ? val : 'createdAt';
  }),
  order: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const upper = val.toUpperCase();
    return upper === 'ASC' || upper === 'DESC' ? upper : 'DESC';
  }),
  fecha: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener un formato válido YYYY-MM-DD')
    .refine(esFechaValida, 'La fecha debe tener un formato válido YYYY-MM-DD')
    .optional(),
  estado: z.enum(['pendiente', 'aprobada', 'rechazada', 'cancelada'], {
    message: 'El estado no es válido'
  }).optional(),
  aulaId: z.coerce.number({ message: 'El aulaId debe ser un número entero válido' })
    .int('El aulaId debe ser un número entero válido')
    .positive('El aulaId debe ser un número entero válido')
    .optional(),
  q: z.string().max(255, 'La búsqueda no puede superar los 255 caracteres').optional()
});

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const estaVacio = (valor) =>
  valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

const esEntero = (valor) => {
  if (typeof valor === 'number') return Number.isInteger(valor);
  if (typeof valor === 'string' && /^-?\d+$/.test(valor.trim())) return true;
  return false;
};

const validarFormatoCamposReserva = (req, res) => {
  const { aulaId, fecha, horaInicio, horaFin, cantidadPersonas, motivo } = req.body;

  if (aulaId !== undefined) {
    if (!esEntero(aulaId) || Number(aulaId) <= 0) {
      return res.status(400).json({
        error: 'El aulaId debe ser un número entero válido'
      });
    }
    req.body.aulaId = Number(aulaId);
  }

  if (fecha !== undefined) {
    if (!esFechaValida(fecha)) {
      return res.status(400).json({
        error: 'La fecha debe tener un formato válido YYYY-MM-DD'
      });
    }
    if (esFechaPasada(fecha)) {
      return res.status(400).json({
        error: 'No se permiten reservas en una fecha pasada'
      });
    }
  }

  if (horaInicio !== undefined) {
    if (typeof horaInicio !== 'string' || !HORA_REGEX.test(horaInicio)) {
      return res.status(400).json({
        error: 'La hora de inicio debe tener el formato HH:MM'
      });
    }
  }

  if (horaFin !== undefined) {
    if (typeof horaFin !== 'string' || !HORA_REGEX.test(horaFin)) {
      return res.status(400).json({
        error: 'La hora de fin debe tener el formato HH:MM'
      });
    }
  }

  if (cantidadPersonas !== undefined) {
    if (!esEntero(cantidadPersonas) || Number(cantidadPersonas) <= 0) {
      return res.status(400).json({
        error: 'La cantidad de personas debe ser un número entero mayor a 0'
      });
    }
    req.body.cantidadPersonas = Number(cantidadPersonas);
  }

  if (motivo !== undefined) {
    if (typeof motivo !== 'string' || motivo.trim().length === 0) {
      return res.status(400).json({
        error: 'El motivo no puede estar vacío'
      });
    }
    if (motivo.length > 255) {
      return res.status(400).json({
        error: 'El motivo no puede superar los 255 caracteres'
      });
    }
  }

  return null;
};

export const validarCrearReserva = (req, res, next) => {
  const { aulaId, fecha, horaInicio, horaFin, cantidadPersonas, motivo } = req.body;
  const faltantes = [];

  if (estaVacio(aulaId))           faltantes.push('aulaId');
  if (estaVacio(fecha))            faltantes.push('fecha');
  if (estaVacio(horaInicio))       faltantes.push('horaInicio');
  if (estaVacio(horaFin))          faltantes.push('horaFin');
  if (estaVacio(cantidadPersonas)) faltantes.push('cantidadPersonas');
  if (estaVacio(motivo))           faltantes.push('motivo');

  if (faltantes.length > 0) {
    return res.status(400).json({
      error: `Faltan campos obligatorios: ${faltantes.join(', ')}`
    });
  }

  if (validarFormatoCamposReserva(req, res)) {
    return;
  }

  next();
};

export const validarEditarReserva = (req, res, next) => {
  if (validarFormatoCamposReserva(req, res)) {
    return;
  }

  next();
};

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

  if (!nombre)   faltantes.push('nombre');
  if (!email)    faltantes.push('email');
  if (!password) faltantes.push('password');

  if (faltantes.length > 0) {
    return res.status(400).json({
      error: `Faltan campos obligatorios: ${faltantes.join(', ')}`
    });
  }

  next();
};
