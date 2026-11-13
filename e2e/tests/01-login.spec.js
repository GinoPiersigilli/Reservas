import { test, expect } from '../soporte/fixtures.js';
import { CREDENCIALES, iniciarSesion } from '../soporte/ayudas.js';

test.describe('Flujo 1 — Inicio de sesión', () => {
  test('un usuario con credenciales válidas accede a sus reservas', async ({ page }) => {
    await iniciarSesion(page, CREDENCIALES.usuario);

    await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
    // El nombre debe mostrarse con sus acentos intactos (no "David LÃ³pez").
    await expect(page.getByRole('complementary', { name: 'Navegación principal' })).toContainText(
      CREDENCIALES.usuario.nombre
    );
  });

  test('un administrador ve los destinos de administración', async ({ page }) => {
    await iniciarSesion(page, CREDENCIALES.admin);

    const navegacion = page.getByRole('complementary', { name: 'Navegación principal' });
    await expect(navegacion.getByRole('link', { name: 'Panel' })).toBeVisible();
    await expect(navegacion.getByRole('link', { name: 'Aulas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reservas', level: 1 })).toBeVisible();
  });

  test('con credenciales inválidas se informa el error y no se accede', async ({ page }) => {
    await page.goto('/login');
    await page
      .getByRole('textbox', { name: 'Correo electrónico' })
      .fill(CREDENCIALES.usuario.email);
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('contrasena-incorrecta');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('cerrar sesión devuelve al inicio de sesión y protege el listado', async ({ page }) => {
    await iniciarSesion(page, CREDENCIALES.usuario);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/login/);
    await page.goto('/reservas');
    await expect(page).toHaveURL(/\/login/);
  });
});
