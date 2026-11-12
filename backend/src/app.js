import env from './config/env.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import sequelize from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import reservasRoutes from './routes/reservas.routes.js';
import aulaRoutes from './routes/aulas.routes.js';
import { limiteGeneral } from './middleware/rateLimit.middleware.js';
import { manejadorErrores } from './middleware/error.middleware.js';

const app = express();

if (env.TRUST_PROXY_HOPS > 0) {
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
} else {
  app.set('trust proxy', false);
}

app.use(helmet());

app.use(cors({
  origin: env.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.get('/', (req, res) => res.send('Backend funcionando'));

app.get('/api/health', async (_req, res) => {
  try {
    await sequelize.authenticate();
    return res.status(200).json({
      status: 'ok',
      db: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch {
    return res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: 'No se pudo verificar la conexión con la base de datos'
    });
  }
});

app.use('/api', limiteGeneral);

app.use('/api/auth', authRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/aulas', aulaRoutes);

app.use(manejadorErrores);

export default app;
