import { expect, test } from '@playwright/test';
import { CREDENCIALES, fechaEnDias } from '../soporte/ayudas.js';

const DIA = fechaEnDias(28);

/** Pausa deliberada: sin ella el video pasa de una pantalla a la otra sin que se lea nada. */
const leer = (page, ms = 1100) => page.waitForTimeout(ms);

/** Mueve el cursor sobre el control para que se aprecie el `:hover` antes del clic. */
const apuntarYClick = async (locator, page, pausaMs = 260) => {
  await locator.hover();
  await leer(page, pausaMs);
  await locator.click();
};

/**
 * Recorrido completo para el GIF del README: solicitar una reserva como
 * docente y aprobarla como administración.
 *
 * Es una grabación, no una prueba, pero igual verifica lo que muestra: si un
 * paso del recorrido deja de funcionar, la grabación falla en lugar de
 * producir un video de una aplicación rota.
 */
// `video` fuerza un worker nuevo, así que va al nivel del archivo y no dentro
// de un `describe`.
test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: 'on', size: { width: 1280, height: 720 } },
  reducedMotion: 'no-preference'
});

test.describe('Recorrido para el GIF', () => {
  test('solicitar una reserva y aprobarla', async ({ page }) => {
    // 1. Inicio de sesión como docente.
    await page.goto('/login');
    await leer(page, 800);
    await page
      .getByRole('textbox', { name: 'Correo electrónico' })
      .pressSequentially(CREDENCIALES.usuario.email, { delay: 45 });
    await page
      .getByRole('textbox', { name: 'Contraseña' })
      .pressSequentially(CREDENCIALES.usuario.password, { delay: 45 });
    await leer(page, 400);
    await apuntarYClick(page.getByRole('button', { name: 'Ingresar' }), page, 220);
    await expect(page).toHaveURL(/\/reservas$/);

    // 2. La agenda del docente.
    await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
    await leer(page, 1600);

    // 3. Elegir fecha y franja en la grilla.
    await apuntarYClick(page.getByRole('button', { name: 'Nueva reserva' }), page);
    await expect(page.getByRole('heading', { name: 'Nueva reserva', level: 1 })).toBeVisible();
    await leer(page, 700);

    await page.getByRole('textbox', { name: 'Fecha' }).fill(DIA);
    await leer(page, 900);

    const grilla = page.getByRole('region', { name: 'Grilla de disponibilidad horaria' });
    await apuntarYClick(
      grilla.getByRole('button', { name: /Aula Magna, 14:00 a 14:30, libre/i }),
      page
    );
    await leer(page, 350);
    await grilla.getByRole('button', { name: /Aula Magna, 14:30 a 15:00, libre/i }).hover();
    await leer(page, 240);
    await grilla.getByRole('button', { name: /Aula Magna, 15:00 a 15:30, libre/i }).hover();
    await leer(page, 240);
    await grilla.getByRole('button', { name: /Aula Magna, 15:30 a 16:00, libre/i }).hover();
    await leer(page, 400);
    await grilla.getByRole('button', { name: /Aula Magna, 15:30 a 16:00, libre/i }).click();
    await leer(page, 900);

    // 4. Completar y enviar.
    await page.getByRole('spinbutton', { name: /Cantidad de personas/i }).fill('80');
    await page
      .getByRole('textbox', { name: 'Motivo' })
      .pressSequentially('Defensa de tesina — Ingeniería en Sistemas', { delay: 25 });
    await leer(page, 1200);
    await apuntarYClick(page.getByRole('button', { name: 'Reservar aula' }), page);

    // 5. El detalle, con la reserva pendiente y su historial.
    await expect(page.getByRole('heading', { name: /Reserva #/, level: 1 })).toBeVisible();
    const idReserva = page.url().split('/').pop();
    await leer(page, 1800);

    // 6. Administración la aprueba desde el panel.
    await apuntarYClick(page.getByRole('button', { name: 'Cerrar sesión' }), page);
    await expect(page).toHaveURL(/\/login/);
    await leer(page, 500);

    await page
      .getByRole('textbox', { name: 'Correo electrónico' })
      .pressSequentially(CREDENCIALES.admin.email, { delay: 40 });
    await page
      .getByRole('textbox', { name: 'Contraseña' })
      .pressSequentially(CREDENCIALES.admin.password, { delay: 40 });
    await apuntarYClick(page.getByRole('button', { name: 'Ingresar' }), page, 220);
    await expect(page).toHaveURL(/\/reservas$/);
    await leer(page, 700);

    await apuntarYClick(page.getByRole('link', { name: 'Panel' }), page, 320);
    await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();
    await leer(page, 1600);

    // La cola lista aula, fecha, horario y solicitante, no el motivo: la fila
    // se identifica por el número de reserva.
    const cola = page.getByRole('table', { name: /Cola de reservas pendientes/i });
    const fila = cola.getByRole('row').filter({ hasText: `#${idReserva}` });
    await expect(fila).toBeVisible();
    await apuntarYClick(fila.getByRole('button', { name: 'Aprobar' }), page);

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await leer(page, 1200);
    await apuntarYClick(dialogo.getByRole('button', { name: 'Aprobar' }), page);

    // 7. La solicitud desaparece de la cola.
    await expect(fila).toHaveCount(0);
    await leer(page, 2000);
  });
});
