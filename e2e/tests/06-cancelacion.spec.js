import { test, expect } from '../soporte/fixtures.js';
import {
  CREDENCIALES,
  crearReservaApi,
  datosReserva,
  iniciarSesion,
  obtenerToken
} from '../soporte/ayudas.js';

test.describe('Flujo 6 — Cancelación', () => {
  test('el solicitante cancela su propia reserva', async ({ page, request }) => {
    const token = await obtenerToken(request, CREDENCIALES.usuario);
    const reserva = await crearReservaApi(request, token, datosReserva({ dia: 50 }));

    await iniciarSesion(page, CREDENCIALES.usuario);
    await page.goto(`/reservas/${reserva.id}`);
    await page.getByRole('button', { name: 'Cancelar reserva' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('¿Confirma que desea cancelar esta reserva?');
    await dialogo.getByRole('button', { name: 'Cancelar reserva' }).click();

    await expect(page.getByRole('main')).toContainText('Cancelada');
    await expect(page.getByRole('button', { name: 'Cancelar reserva' })).toBeHidden();
  });

  test('una reserva cancelada libera su franja horaria', async ({ page, request }) => {
    const token = await obtenerToken(request, CREDENCIALES.usuario);
    const datos = datosReserva({ dia: 51, aulaId: 1, horaInicio: '19:00', horaFin: '20:00' });
    const reserva = await crearReservaApi(request, token, datos);

    await iniciarSesion(page, CREDENCIALES.usuario);
    await page.goto(`/reservas/${reserva.id}`);
    await page.getByRole('button', { name: 'Cancelar reserva' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar reserva' }).click();
    await expect(page.getByRole('main')).toContainText('Cancelada');

    await page.goto('/reservas/nueva');
    await page.getByRole('textbox', { name: 'Fecha' }).fill(datos.fecha);
    const grilla = page.getByRole('region', { name: 'Grilla de disponibilidad horaria' });
    await expect(
      grilla.getByRole('button', { name: /Aula 910, 19:00 a 19:30, libre/i })
    ).toBeVisible();
  });
});
