// src/utils/logger.js
import env from '../config/env.js';
import { sanitizarMensaje } from './sanitizar.js';

/**
 * Logger estructurado: una línea JSON por evento, apta para que cualquier
 * recolector (Docker, Loki, CloudWatch) la indexe sin configuración extra.
 *
 * Se escribe a mano, sin pino ni winston, por tres razones: el proyecto no
 * necesita transportes ni rotación (eso lo hace el runtime del contenedor),
 * cada campo que sale pasa por el saneado de secretos de SEC-CFG-03, y así no
 * se agrega una dependencia de producción para 60 líneas de código. La decisión
 * y su punto de quiebre están en docs/adr/0005-logger-propio.md.
 */

const NIVELES = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const nivelActual = () => NIVELES[env.LOG_LEVEL] ?? NIVELES.info;

/** Nunca se registran estas claves, vengan de donde vengan. */
const CLAVES_PROHIBIDAS = new Set([
  'password',
  'passwordhash',
  'token',
  'authorization',
  'jwt_secret',
  'secret',
  'cookie',
  'set-cookie'
]);

const limpiarError = (valor) => ({
  nombre: valor.name,
  mensaje: sanitizarMensaje(valor.message),
  codigo: valor.parent?.code || valor.original?.code
});

const esPrimitivo = (valor) => typeof valor === 'number' || typeof valor === 'boolean';

const limpiarObjeto = (valor, profundidad) => {
  const salida = {};
  for (const [clave, v] of Object.entries(valor)) {
    salida[clave] = CLAVES_PROHIBIDAS.has(clave.toLowerCase())
      ? '[REDACTED]'
      : limpiar(v, profundidad + 1);
  }
  return salida;
};

/**
 * Deja los datos listos para serializar: oculta secretos en los textos,
 * descarta claves sensibles y corta la profundidad para no volcar objetos
 * enormes (una instancia de Sequelize, por ejemplo).
 */
const limpiar = (valor, profundidad = 0) => {
  if (valor === null || valor === undefined || esPrimitivo(valor)) return valor;
  if (typeof valor === 'string') return sanitizarMensaje(valor);
  if (valor instanceof Date) return valor.toISOString();
  if (valor instanceof Error) return limpiarError(valor);
  if (profundidad >= 3) return '[objeto omitido]';
  if (Array.isArray(valor)) return valor.slice(0, 20).map((v) => limpiar(v, profundidad + 1));
  if (typeof valor === 'object') return limpiarObjeto(valor, profundidad);
  return String(valor);
};

const escribir = (nivel, mensaje, datos, contexto) => {
  if (NIVELES[nivel] < nivelActual()) return;

  const evento = {
    hora: new Date().toISOString(),
    nivel,
    mensaje: sanitizarMensaje(mensaje),
    ...contexto,
    ...limpiar(datos ?? {})
  };

  const linea = JSON.stringify(evento);
  if (nivel === 'error' || nivel === 'warn') {
    process.stderr.write(`${linea}\n`);
  } else {
    process.stdout.write(`${linea}\n`);
  }
};

const crearLogger = (contexto = {}) => ({
  debug: (mensaje, datos) => escribir('debug', mensaje, datos, contexto),
  info: (mensaje, datos) => escribir('info', mensaje, datos, contexto),
  warn: (mensaje, datos) => escribir('warn', mensaje, datos, contexto),
  error: (mensaje, datos) => escribir('error', mensaje, datos, contexto),

  /** Logger derivado que arrastra campos fijos, como el id de la petición. */
  hijo: (extra) => crearLogger({ ...contexto, ...extra })
});

export const logger = crearLogger();
export default logger;
