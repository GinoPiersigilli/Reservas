import { test, expect } from '@playwright/test';
import {
  CREDENCIALES,
  crearReservaApi,
  datosReserva,
  iniciarSesion,
  obtenerToken,
  URL_API
} from '../soporte/ayudas.js';

test.describe('Flujo 5 — Consulta del historial', () => {
  test('el historial registra la creación y la aprobación de una reserva', async ({
    page,
    request
  }) => {
    const tokenUsuario = await obtenerToken(request, CREDENCIALES.usuario);
    const reserva = await crearReservaApi(request, tokenUsuario, datosReserva({ dia: 40 }));

    const tokenAdmin = await obtenerToken(request, CREDENCIALES.admin);
    const aprobacion = await request.patch(`${URL_API}/reservas/${reserva.id}/aprobar`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    expect(aprobacion.ok()).toBeTruthy();

    await iniciarSesion(page, CREDENCIALES.usuario);
    await page.goto(`/reservas/${reserva.id}`);

    const historial = page.getByRole('table', { name: 'Historial de cambios de la reserva' });
    await expect(historial.getByRole('row').filter({ hasText: 'Creación' })).toBeVisible();
    const filaAprobacion = historial.getByRole('row').filter({ hasText: 'Aprobación' });
    await expect(filaAprobacion).toBeVisible();
    await expect(filaAprobacion).toContainText('aprobada');
  });
});
