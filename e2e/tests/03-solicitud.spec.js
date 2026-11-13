import { test, expect } from '../soporte/fixtures.js';
import { CREDENCIALES, fechaEnDias, iniciarSesion, irANuevaReserva } from '../soporte/ayudas.js';

test.describe('Flujo 3 — Solicitud de reserva', () => {
  test('un usuario solicita un aula eligiendo la franja en la grilla', async ({ page }) => {
    const fecha = fechaEnDias(18);
    await iniciarSesion(page, CREDENCIALES.usuario);
    await irANuevaReserva(page);

    await page.getByRole('textbox', { name: 'Fecha' }).fill(fecha);
    await page.getByRole('combobox', { name: 'Aula' }).selectOption({ label: 'Laboratorio A6' });
    await page.getByRole('spinbutton', { name: 'Cantidad de personas' }).fill('18');
    await page.getByRole('button', { name: /Laboratorio A6, 15:00 a 15:30, libre/i }).click();

    await expect(page.getByRole('textbox', { name: 'Hora de inicio' })).toHaveValue('15:00');
    await page.getByRole('textbox', { name: 'Motivo' }).fill('Taller de integración continua');

    // El resumen solo aparece cuando el formulario tomó fecha, aula y horario:
    // sirve de punto de sincronización antes de enviar.
    await expect(page.getByText(/^Seleccionado:/)).toContainText('15:00 a 15:30');

    // Se espera la respuesta del alta, de modo que un fallo distinga entre
    // "no se envió" y "el servidor la rechazó".
    const [respuesta] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith('/api/reservas') && res.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Reservar aula' }).click()
    ]);
    expect(respuesta.status(), await respuesta.text()).toBe(201);

    await expect(page).toHaveURL(/\/reservas\/\d+$/);
    const datos = page.getByRole('region', { name: 'Datos de la reserva' });
    await expect(datos).toContainText('Laboratorio A6');
    await expect(datos).toContainText('Taller de integración continua');
    await expect(page.getByRole('main')).toContainText('Pendiente');
  });

  test('se rechaza una solicitud que supera la capacidad del aula', async ({ page }) => {
    await iniciarSesion(page, CREDENCIALES.usuario);
    await page.goto('/reservas/nueva');

    await page.getByRole('textbox', { name: 'Fecha' }).fill(fechaEnDias(19));
    await page
      .getByRole('combobox', { name: 'Aula' })
      .selectOption({ label: 'Sala de Reuniones B' });
    await page.getByRole('spinbutton', { name: 'Cantidad de personas' }).fill('500');
    await page.getByRole('button', { name: /Sala de Reuniones B, 16:00 a 16:30, libre/i }).click();
    await page.getByRole('textbox', { name: 'Motivo' }).fill('Reunión con exceso de personas');
    await page.getByRole('button', { name: 'Reservar aula' }).click();

    await expect(page.getByText(/capacidad/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/reservas\/nueva$/);
  });

  test('una franja ya ocupada no puede solicitarse dos veces', async ({ page }) => {
    const fecha = fechaEnDias(22);
    await iniciarSesion(page, CREDENCIALES.usuario);

    for (const intento of [1, 2]) {
      await page.goto('/reservas/nueva');
      await page.getByRole('textbox', { name: 'Fecha' }).fill(fecha);
      await page.getByRole('combobox', { name: 'Aula' }).selectOption({ label: 'Aula Magna' });
      await page.getByRole('spinbutton', { name: 'Cantidad de personas' }).fill('20');
      await page.getByRole('textbox', { name: 'Hora de inicio' }).fill('11:00');
      await page.getByRole('textbox', { name: 'Hora de fin' }).fill('12:00');
      await page.getByRole('textbox', { name: 'Motivo' }).fill(`Intento número ${intento}`);
      await page.getByRole('button', { name: 'Reservar aula' }).click();

      if (intento === 1) {
        await expect(page).toHaveURL(/\/reservas\/\d+$/);
      } else {
        await expect(page.getByText(/ya está reservada en ese horario/i)).toBeVisible();
      }
    }
  });
});
