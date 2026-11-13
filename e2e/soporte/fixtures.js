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
    const respuestasClave = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') problemas.push(`consola: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problemas.push(`excepción en la página: ${err.message}`));
    page.on('requestfailed', (req) => {
      problemas.push(`pedido fallido: ${req.method()} ${req.url()} (${req.failure()?.errorText})`);
    });
    page.on('response', async (res) => {
      // La disponibilidad alimenta la grilla: se guarda aunque responda 200,
      // porque una grilla vacía con respuestas correctas apunta al frontend.
      if (res.ok() && /\/api\/aulas\/\d+\/disponibilidad/.test(res.url())) {
        try {
          const url = new URL(res.url());
          respuestasClave.push(
            `200 ${url.pathname}${url.search} -> ${(await res.text()).slice(0, 200)}`
          );
        } catch {
          /* la respuesta pudo descartarse */
        }
        return;
      }
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

    if (testInfo.status === testInfo.expectedStatus) return;

    // Estado visible al momento de la falla: la dirección y los avisos de
    // error explican, por ejemplo, un envío detenido por validación.
    const estado = [];
    try {
      estado.push(`dirección: ${page.url()}`);
      const avisos = await page.locator('[role="alert"]').allTextContents();
      if (avisos.length > 0) estado.push(`avisos: ${avisos.join(' | ')}`);
      const campos = await page.locator('input, select, textarea').evaluateAll((nodos) =>
        nodos
          .map((n) => `${n.name || n.id || n.type}=${JSON.stringify(n.value)}`)
          .filter((t) => !t.startsWith('password'))
          .join(', ')
      );
      if (campos) estado.push(`campos: ${campos}`);
    } catch {
      /* la página pudo cerrarse */
    }

    const detalle = [...estado, ...problemas, ...respuestasClave.slice(-6)];
    if (detalle.length === 0) return;

    await testInfo.attach('llamadas-y-respuestas', {
      body: detalle.join('\n'),
      contentType: 'text/plain'
    });
    console.log(
      `\n[diagnóstico] ${testInfo.title}\n${detalle.map((d) => `  - ${d}`).join('\n')}\n`
    );
  }
});

export { expect };
