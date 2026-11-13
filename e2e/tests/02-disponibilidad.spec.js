import { test, expect } from '../soporte/fixtures.js';
import {
  CREDENCIALES,
  crearReservaApi,
  fechaEnDias,
  iniciarSesion,
  irANuevaReserva,
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
    await irANuevaReserva(page);
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

    // Hay que esperar a que llegue el listado ya filtrado antes de afirmar que
    // no hay pendientes: sin esta espera la aserción puede leer la lista previa
    // al filtro, que sí los tiene, y falla de forma intermitente.
    const [respuesta] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/reservas?') && r.url().includes('estado=aprobada')
      ),
      filtros.getByRole('button', { name: 'Filtrar' }).click()
    ]);
    expect(respuesta.ok()).toBeTruthy();

    const agenda = page.getByRole('region', { name: 'Agenda de reservas' });
    const items = agenda.getByRole('listitem');
    await expect(items.filter({ hasText: 'Aprobada' }).first()).toBeVisible();
    await expect(items.filter({ hasText: 'Pendiente' })).toHaveCount(0);
  });

  test('la agenda agrupa por jornada y la tabla queda a un clic', async ({ page }) => {
    await iniciarSesion(page, CREDENCIALES.admin);

    // La agenda es la vista por defecto: encabezado de día y tramo horario.
    const agenda = page.getByRole('region', { name: 'Agenda de reservas' });
    await expect(agenda.getByRole('heading').first()).toBeVisible();
    await expect(agenda.getByRole('link').first()).toHaveAttribute('href', /\/reservas\/\d+/);

    // La tabla ordenable sigue estando, y la elección se recuerda al volver.
    await page.getByRole('button', { name: 'Tabla' }).click();
    const tabla = page.getByRole('table', { name: 'Listado de reservas' });
    await expect(tabla).toBeVisible();
    await expect(agenda).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('table', { name: 'Listado de reservas' })).toBeVisible();

    await page.getByRole('button', { name: 'Agenda' }).click();
    await expect(page.getByRole('region', { name: 'Agenda de reservas' })).toBeVisible();
  });
});
