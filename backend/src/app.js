import env from './config/env.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import reservasRoutes from './routes/reservas.routes.js';
import aulaRoutes from './routes/aulas.routes.js';
import healthRoutes from './routes/health.routes.js';
import { limiteGeneral } from './middleware/rateLimit.middleware.js';
import { manejadorErrores } from './middleware/error.middleware.js';
import { asignarRequestId, registrarPeticiones } from './middleware/observabilidad.middleware.js';
import { purgarClavesVencidas } from './services/idempotencia.services.js';
import docsRoutes from './routes/docs.routes.js';
import logger from './utils/logger.js';

const app = express();

// Purgar claves de idempotencia vencidas al iniciar
purgarClavesVencidas().catch(() => {});

if (env.TRUST_PROXY_HOPS > 0) {
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
} else {
  app.set('trust proxy', false);
}

// Primero el id de petición: todo lo que se registre después puede atribuirse
// a una petición concreta, incluido lo que falle en los middlewares siguientes.
app.use(asignarRequestId);
app.use(registrarPeticiones);

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    // X-Request-Id: el frontend envía su propio identificador de petición y
    // necesita poder leer el que devuelve el servidor (ver docs/ARQUITECTURA.md §8.1).
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['Idempotent-Replay', 'Retry-After', 'X-Request-Id'],
    credentials: true
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.get('/', (req, res) => res.send('Backend funcionando'));

// Las sondas de estado quedan antes del limitador general: un orquestador las
// consulta cada pocos segundos y no debe poder quedarse sin cupo.
app.use('/api/health', healthRoutes);

app.use('/api', limiteGeneral);

// La documentación nunca se publica en producción.
if (env.NODE_ENV !== 'production') {
  app.use('/api/docs', docsRoutes);
  if (env.NODE_ENV !== 'test') {
    logger.info('documentacion openapi disponible', { ruta: '/api/docs/ui' });
  }
}

app.use('/api/auth', authRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/aulas', aulaRoutes);

app.use(manejadorErrores);

export default app;
