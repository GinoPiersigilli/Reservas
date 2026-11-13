// src/services/idempotencia.services.js
import crypto from 'crypto';
import { Op } from 'sequelize';
import IdempotencyKey from '../models/idempotencyKey.model.js';
import logger from '../utils/logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const esUuidValido = (clave) => {
  if (typeof clave !== 'string') return false;
  return UUID_REGEX.test(clave.trim());
};

export const canonicalJsonStringify = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return (
    '{' + keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`).join(',') + '}'
  );
};

export const calcularHashCuerpo = (cuerpo) => {
  const canonical = canonicalJsonStringify(cuerpo || {});
  return crypto.createHash('sha256').update(canonical).digest('hex');
};

export const purgarClavesVencidas = async () => {
  try {
    const eliminadas = await IdempotencyKey.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date()
        }
      }
    });
    return eliminadas;
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      logger.warn('no se pudieron purgar las claves de idempotencia vencidas', { error: err });
    }
    return 0;
  }
};
