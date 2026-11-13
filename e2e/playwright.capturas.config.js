import { defineConfig } from '@playwright/test';
import { servidores, URL_WEB } from './soporte/entorno.js';

/**
 * Configuración del generador de capturas de `docs/img`.
 *
 * Levanta el mismo entorno que las pruebas de extremo a extremo —la API real
 * contra la base sembrada y la SPA compilada— para que las imágenes de la
 * documentación muestren la aplicación tal cual es.
 *
 * Se corre aparte de las pruebas (`npm run capturas`) porque escribe archivos
 * en el repositorio: no es una verificación, es la generación de un artefacto.
 */
export default defineConfig({
  testDir: './capturas',
  // El video del recorrido se escribe acá y lo recoge `soporte/gif-recorrido.sh`.
  outputDir: './salida-capturas',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: URL_WEB,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
    // Los campos nativos de fecha y hora se formatean según el idioma de la
    // interfaz del navegador, no según el `locale` de la página: sin esto las
    // capturas salen con «12/04/2026» y «11:00 AM» en lugar de «04/12/2026» y
    // «14:30». En Linux manda la variable de entorno y en Windows el
    // argumento, así que se pasan los dos.
    launchOptions: {
      args: ['--lang=es-AR'],
      env: { ...process.env, LANG: 'es_AR.UTF-8', LANGUAGE: 'es_AR:es' }
    }
  },
  webServer: servidores
});
