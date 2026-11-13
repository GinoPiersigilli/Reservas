import { defineConfig, devices } from '@playwright/test';
import { servidores, URL_WEB } from './soporte/entorno.js';

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
  webServer: servidores
});
