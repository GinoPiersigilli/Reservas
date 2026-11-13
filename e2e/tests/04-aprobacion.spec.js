import { test, expect } from '@playwright/test';
import {
  CREDENCIALES,
  crearReservaApi,
  datosReserva,
  iniciarSesion,
  obtenerToken
} from '../soporte/ayudas.js';

test.describe('Flujo 4 — Aprobación administrativa', () => {
  test('el administrador aprueba una solicitud desde el detalle', async ({ page, request }) => {
    const token = await obtenerToken(request, CREDENCIALES.usuario);
    const reserva = await crearReservaApi(request, token, datosReserva({ dia: 30 }));

    await iniciarSesion(page, CREDENCIALES.admin);
    await page.goto(`/reservas/${reserva.id}`);
    await page.getByRole('button', { name: 'Aprobar' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('Aprobar solicitud');
    await dialogo.getByRole('button', { name: 'Aprobar' }).click();

    await expect(page.getByRole('main')).toContainText('Aprobada');
    await expect(page.getByRole('button', { name: 'Aprobar' })).toBeHidden();
  });

  test('el administrador rechaza una solicitud desde el panel', async ({ page, request }) => {
    const token = await obtenerToken(request, CREDENCIALES.usuario);
    const reserva = await crearReservaApi(request, token, datosReserva({ dia: 31 }));

    await iniciarSesion(page, CREDENCIALES.admin);
    await page.getByRole('link', { name: 'Panel' }).click();

    const fila = page
      .getByRole('region', { name: /Pendientes de aprobación/ })
      .getByRole('row')
      .filter({ hasText: `#${reserva.id}` });
    await fila.getByRole('button', { name: 'Rechazar' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('Rechazar solicitud');
    await dialogo.getByRole('button', { name: 'Rechazar' }).click();

    await expect(fila).toBeHidden();
    await page.goto(`/reservas/${reserva.id}`);
    await expect(page.getByRole('main')).toContainText('Rechazada');
  });
});
