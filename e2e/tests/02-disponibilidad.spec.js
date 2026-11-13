import { test, expect } from '../soporte/fixtures.js';
import {
  CREDENCIALES,
  crearReservaApi,
  fechaEnDias,
  iniciarSesion,
  obtenerToken
} from '../soporte/ayudas.js';

test.describe('Flujo 2 — Consulta de disponibilidad', () => {
  test('la grilla muestra las franjas ocupadas de una reserva existente', async ({
    page,
    request
  }) => {
    const fecha = fechaEnDias(15);
    const token = await obtenerToken(request, CREDENCIALES.usuario);
    await crearReservaApi(request, token, {
      aulaId: 1,
      fecha,
      horaInicio: '10:00',
      horaFin: '11:00',
      cantidadPersonas: 10,
      motivo: 'Reserva previa para consultar disponibilidad'
    });

    await iniciarSesion(page, CREDENCIALES.usuario);
    await page.getByRole('button', { name: 'Nueva reserva' }).click();
    await page.getByRole('textbox', { name: 'Fecha' }).fill(fecha);

    const grilla = page.getByRole('region', { name: 'Grilla de disponibilidad horaria' });
    // La franja reservada aparece como pendiente; una fuera del rango sigue libre.
    await expect(
      grilla.getByRole('button', { name: /Aula 910, 10:00 a 11:00, ocupada \(Pendiente\)/i })
    ).toBeVisible();
    await expect(
      grilla.getByRole('button', { name: /Aula 910, 12:00 a 12:30, libre/i })
    ).toBeVisible();
  });

  test('los filtros del listado acotan los resultados', async ({ page }) => {
    await iniciarSesion(page, CREDENCIALES.admin);

    const filtros = page.getByRole('region', { name: 'Filtros de búsqueda' });
    await filtros.getByRole('combobox', { name: 'Estado' }).selectOption('aprobada');
    await filtros.getByRole('button', { name: 'Filtrar' }).click();

    const filas = page.getByRole('table', { name: 'Listado de reservas' }).getByRole('row');
    await expect(filas.filter({ hasText: 'Aprobada' }).first()).toBeVisible();
    await expect(filas.filter({ hasText: 'Pendiente' })).toHaveCount(0);
  });
});
