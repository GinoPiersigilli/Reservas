// src/middleware/rateLimit.middleware.js
import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

let testLimitGeneral = null;
let testLimitEscrituras = null;
let testLimitUsuario = null;

export const setTestRateLimits = ({ general, escrituras, usuario } = {}) => {
  if (general !== undefined) testLimitGeneral = general;
  if (escrituras !== undefined) testLimitEscrituras = escrituras;
  if (usuario !== undefined) testLimitUsuario = usuario;
};

export const resetTestRateLimits = () => {
  testLimitGeneral = null;
  testLimitEscrituras = null;
  testLimitUsuario = null;
};

export const crearLimitador = ({
  windowMs = 15 * 60 * 1000,
  max,
  message = 'Demasiadas solicitudes desde esta IP, por favor intente nuevamente más tarde',
  skip,
  keyGenerator
} = {}) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false, keyGeneratorIpFallback: false },
    skip,
    keyGenerator,
    handler: (req, res, _next, options) => {
      const resetTime = req.rateLimit?.resetTime;
      if (!res.getHeader('Retry-After') && resetTime) {
        const segundos = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
        res.setHeader('Retry-After', String(segundos));
      }

      const mensajeError =
        typeof options.message === 'string'
          ? options.message
          : options.message?.error ||
            'Demasiadas solicitudes desde esta IP, por favor intente nuevamente más tarde';

      return res.status(options.statusCode || 429).json({
        error: mensajeError
      });
    },
    message
  });
};

export const limiteGeneral = crearLimitador({
  windowMs: env.RATE_LIMIT_GENERAL_WINDOW_MS,
  max: () => {
    if (testLimitGeneral !== null) return testLimitGeneral;
    if (process.env.RATE_LIMIT_GENERAL_MAX) return Number(process.env.RATE_LIMIT_GENERAL_MAX);
    return env.RATE_LIMIT_GENERAL_MAX;
  },
  skip: (req) => {
    const url = req.originalUrl || req.url || '';
    return url.startsWith('/api/health') || req.path === '/health';
  },
  message: 'Demasiadas solicitudes desde esta IP, por favor intente nuevamente más tarde'
});

export const limiteEscrituras = crearLimitador({
  windowMs: env.RATE_LIMIT_ESCRITURAS_WINDOW_MS,
  max: () => {
    if (testLimitEscrituras !== null) return testLimitEscrituras;
    if (process.env.RATE_LIMIT_ESCRITURAS_MAX) return Number(process.env.RATE_LIMIT_ESCRITURAS_MAX);
    return env.RATE_LIMIT_ESCRITURAS_MAX;
  },
  message:
    'Demasiadas solicitudes de modificación desde esta IP, por favor intente nuevamente más tarde'
});

export const limiteEscriturasUsuario = crearLimitador({
  windowMs: env.RATE_LIMIT_USUARIO_WINDOW_MS,
  max: () => {
    if (testLimitUsuario !== null) return testLimitUsuario;
    if (process.env.RATE_LIMIT_USUARIO_MAX) return Number(process.env.RATE_LIMIT_USUARIO_MAX);
    return env.RATE_LIMIT_USUARIO_MAX;
  },
  keyGenerator: (req) => {
    if (req.usuario && req.usuario.id) {
      return `usr_${req.usuario.id}`;
    }
    return req.ip || 'anonymous';
  },
  message:
    'Demasiadas solicitudes de modificación para este usuario, por favor intente nuevamente más tarde'
});

export const limiteLogin = crearLimitador({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  max: env.RATE_LIMIT_LOGIN_MAX,
  message: 'Demasiados intentos de inicio de sesión, intente más tarde'
});
