import { test, expect } from '@playwright/test';
import {
  CREDENCIALES,
  crearReservaApi,
  datosReserva,
  iniciarSesion,
  obtenerToken,
  URL_API
} from '../soporte/ayudas.js';

test.describe('Flujo 7 — Intentos de acceso no autorizado', () => {
  test('sin sesión, las rutas privadas redirigen al inicio de sesión', async ({ page }) => {
    for (const ruta of ['/reservas', '/reservas/nueva', '/resumen', '/aulas']) {
      await page.goto(ruta);
      await expect(page, `la ruta ${ruta} debe exigir sesión`).toHaveURL(/\/login/);
    }
  });

  test('un usuario común no accede a las vistas de administración', async ({ page }) => {
    await iniciarSesion(page, CREDENCIALES.usuario);

    const navegacion = page.getByRole('complementary', { name: 'Navegación principal' });
    await expect(navegacion.getByRole('link', { name: 'Panel' })).toBeHidden();
    await expect(navegacion.getByRole('link', { name: 'Aulas' })).toBeHidden();

    // Tampoco escribiendo la dirección a mano.
    await page.goto('/resumen');
    await expect(page).toHaveURL(/\/reservas$/);
    await page.goto('/aulas');
    await expect(page).toHaveURL(/\/reservas$/);
  });

  test('la API rechaza peticiones sin token y con token inválido', async ({ request }) => {
    const sinToken = await request.get(`${URL_API}/reservas`);
    expect(sinToken.status()).toBe(401);

    const tokenInvalido = await request.get(`${URL_API}/reservas`, {
      headers: { Authorization: 'Bearer token-falso' }
    });
    expect(tokenInvalido.status()).toBe(401);
  });

  test('un usuario común no puede aprobar reservas ni administrar aulas por API', async ({
    request
  }) => {
    const token = await obtenerToken(request, CREDENCIALES.usuario);
    const reserva = await crearReservaApi(request, token, datosReserva({ dia: 60 }));

    const aprobacion = await request.patch(`${URL_API}/reservas/${reserva.id}/aprobar`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(aprobacion.status()).toBe(403);

    const altaAula = await request.post(`${URL_API}/aulas`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nombre: 'Aula creada sin permisos', ubicacion: 'Sin ubicación', capacidad: 10 }
    });
    expect(altaAula.status()).toBe(403);

    const resumen = await request.get(`${URL_API}/reservas/resumen`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(resumen.status()).toBe(403);
  });

  test('un usuario no puede ver ni cancelar la reserva de otra persona', async ({ request }) => {
    const tokenAdmin = await obtenerToken(request, CREDENCIALES.admin);
    const ajena = await crearReservaApi(request, tokenAdmin, datosReserva({ dia: 61 }));

    const tokenUsuario = await obtenerToken(request, CREDENCIALES.usuario);
    const lectura = await request.get(`${URL_API}/reservas/${ajena.id}`, {
      headers: { Authorization: `Bearer ${tokenUsuario}` }
    });
    expect([403, 404]).toContain(lectura.status());

    const cancelacion = await request.patch(`${URL_API}/reservas/${ajena.id}/cancelar`, {
      headers: { Authorization: `Bearer ${tokenUsuario}` }
    });
    expect([403, 404]).toContain(cancelacion.status());
  });
});
