export const PUERTO_API = 3101;
export const PUERTO_WEB = 4173;
export const URL_WEB = `http://localhost:${PUERTO_WEB}`;
export const URL_API_BASE = `http://localhost:${PUERTO_API}/api`;

const DATABASE_URL =
  process.env.DATABASE_URL_E2E ||
  'postgres://reservas_user:reservas_pass@localhost:5432/reservas_e2e';

/**
 * Los dos servidores del entorno de pruebas: la API contra una base exclusiva
 * (`*_e2e`, recreada en cada corrida) y la SPA compilada en modo e2e.
 *
 * Están acá y no en `playwright.config.js` porque el script de capturas de la
 * documentación levanta exactamente el mismo entorno: así las imágenes del
 * README salen de la aplicación real con los datos sembrados, y no de un
 * backend simulado que se desactualiza sin que nadie se entere.
 */
export const servidores = [
  {
    command: 'node scripts/preparar-db-e2e.js && node index.js',
    cwd: '../backend',
    url: `${URL_API_BASE}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: 'development',
      PORT: String(PUERTO_API),
      DATABASE_URL,
      // Secreto descartable: solo vive durante la corrida.
      JWT_SECRET: process.env.JWT_SECRET_E2E || 'secreto-solo-para-pruebas-e2e-locales',
      CORS_ORIGINS: URL_WEB,
      // Se inicia sesión muchas veces desde la misma IP.
      RATE_LIMIT_LOGIN_MAX: '1000',
      TRUST_PROXY_HOPS: '0'
    }
  },
  {
    command: `npx vite build --mode e2e --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PUERTO_WEB} --strictPort`,
    cwd: '../frontend',
    url: URL_WEB,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_API_BASE_URL: URL_API_BASE,
      VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_no_usada_en_e2e'
    }
  }
];
