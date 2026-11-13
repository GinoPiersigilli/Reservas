import { test as base, expect } from '@playwright/test';

/**
 * `test` con diagnóstico: registra los errores de consola y las respuestas de
 * la API que no son 2xx, y los adjunta al reporte cuando la prueba falla.
 *
 * Sin esto, una falla en CI solo dice "el elemento no apareció", sin indicar
 * qué pidió la aplicación ni qué respondió la API.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const problemas = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') problemas.push(`consola: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problemas.push(`excepción en la página: ${err.message}`));
    page.on('requestfailed', (req) => {
      problemas.push(`pedido fallido: ${req.method()} ${req.url()} (${req.failure()?.errorText})`);
    });
    page.on('response', async (res) => {
      if (res.ok() || !res.url().includes('/api/')) return;
      let cuerpo = '(sin cuerpo)';
      try {
        cuerpo = (await res.text()).slice(0, 300);
      } catch {
        /* la respuesta pudo descartarse */
      }
      problemas.push(
        `${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}${new URL(res.url()).search} -> ${cuerpo}`
      );
    });

    await use(page);

    if (testInfo.status !== testInfo.expectedStatus && problemas.length > 0) {
      const detalle = problemas.join('\n');
      await testInfo.attach('llamadas-con-error', { body: detalle, contentType: 'text/plain' });
      console.log(
        `\n[diagnóstico] ${testInfo.title}\n${problemas.map((p) => `  - ${p}`).join('\n')}\n`
      );
    }
  }
});

export { expect };
