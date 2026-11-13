// src/routes/health.routes.js
import express from 'express';
import sequelize from '../config/database.js';
import logger from '../utils/logger.js';

const router = express.Router();

const TIMEOUT_DB_MS = 2000;

/**
 * Comprueba la base con un límite de tiempo propio: sin él, una base que acepta
 * la conexión pero no responde dejaría la sonda colgada y el orquestador no
 * sabría si el servicio está listo.
 */
const baseResponde = async () => {
  let timer;
  try {
    await Promise.race([
      sequelize.authenticate(),
      new Promise((_, rechazar) => {
        timer = setTimeout(() => rechazar(new Error('timeout')), TIMEOUT_DB_MS);
      })
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, motivo: err.message === 'timeout' ? 'timeout' : 'desconectada' };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Liveness: ¿el proceso está vivo? No toca la base a propósito.
 *
 * Si esta sonda fallara por una base caída, el orquestador reiniciaría un
 * proceso sano una y otra vez sin arreglar nada.
 */
router.get('/live', (_req, res) => {
  res.status(200).json({ status: 'ok', uptimeSegundos: Math.round(process.uptime()) });
});

/** Readiness: ¿puede atender tráfico? Requiere la base disponible. */
router.get('/ready', async (req, res) => {
  const db = await baseResponde();

  if (!db.ok) {
    (req.log || logger).warn('readiness fallida', { db: db.motivo });
    return res.status(503).json({ status: 'error', db: db.motivo });
  }

  return res.status(200).json({ status: 'ok', db: 'ok' });
});

/**
 * Endpoint histórico, equivalente a readiness. Se mantiene porque lo usan los
 * healthcheck de Docker y la documentación publicada.
 */
router.get('/', async (req, res) => {
  const db = await baseResponde();

  if (!db.ok) {
    (req.log || logger).warn('health fallido', { db: db.motivo });
    return res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: 'No se pudo verificar la conexión con la base de datos'
    });
  }

  return res.status(200).json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
});

export default router;
