import { defineConfig, devices } from '@playwright/test';

const PUERTO_API = 3101;
const PUERTO_WEB = 4173;
const URL_WEB = `http://localhost:${PUERTO_WEB}`;
const URL_API = `http://localhost:${PUERTO_API}/api`;

const DATABASE_URL =
  process.env.DATABASE_URL_E2E ||
  'postgres://reservas_user:reservas_pass@localhost:5432/reservas_e2e';

export default defineConfig({
  testDir: './tests',
  // Los flujos comparten una misma base de datos: se ejecutan en serie.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // En CI el primer pedido de cada tipo paga el arranque en frío de la API y
  // del pool de conexiones, así que los márgenes son mayores que en local.
  timeout: process.env.CI ? 90_000 : 30_000,
  expect: { timeout: process.env.CI ? 20_000 : 7_000 },
  use: {
    baseURL: URL_WEB,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // API contra una base exclusiva (*_e2e), recreada en cada corrida.
      command: 'node scripts/preparar-db-e2e.js && node index.js',
      cwd: '../backend',
      url: `${URL_API}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT: String(PUERTO_API),
        DATABASE_URL,
        // Secreto descartable: solo vive durante la corrida de pruebas.
        JWT_SECRET: process.env.JWT_SECRET_E2E || 'secreto-solo-para-pruebas-e2e-locales',
        CORS_ORIGINS: URL_WEB,
        // Las pruebas inician sesión muchas veces desde la misma IP.
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
        VITE_API_BASE_URL: URL_API,
        VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_no_usada_en_e2e'
      }
    }
  ]
});
