import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import {
  CREDENCIALES,
  crearReservaApi,
  fechaEnDias,
  obtenerToken,
  URL_API
} from '../soporte/ayudas.js';

const DIR_IMG = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'docs',
  'img'
);

/** Día con franjas ocupadas, para que la grilla no salga vacía en la captura. */
const DIA_GRILLA = fechaEnDias(21);

/** Anchos donde se verifica que nada desborde en horizontal. */
const ANCHOS_RESPONSIVE = [360, 768, 1280];

const iniciarSesion = async (page, credenciales) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(credenciales.email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(credenciales.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/reservas$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

/** Aplica el tema y recarga: `useTema` lo lee del almacenamiento al montar. */
const usarTema = async (page, tema) => {
  await page.evaluate((valor) => {
    try {
      window.localStorage.setItem('tema', valor);
    } catch {
      // Sin almacenamiento la captura sale en el tema por defecto.
    }
  }, tema);
  await page.reload();
};

/** Deja el listado en agenda o en tabla antes de capturar. */
const usarVista = async (page, vista) => {
  await page.evaluate((valor) => {
    try {
      window.localStorage.setItem('vistaReservas', valor);
    } catch {
      // Sin almacenamiento queda la agenda, que es el valor por defecto.
    }
  }, vista);
  await page.reload();
};

const capturar = async (page, nombre) => {
  // El puntero queda donde terminó la última interacción y deja una fila
  // resaltada que, en una imagen fija, parece un estado sin explicación.
  await page.mouse.move(-20, -20);
  // Las fuentes propias cambian el ancho de todo: sin esperarlas, la captura
  // puede salir con la tipografía de respaldo.
  await page.evaluate(() => document.fonts?.ready);
  await page.screenshot({ path: path.join(DIR_IMG, `${nombre}.png`) });
};

/**
 * Las capturas documentan lo que se ve, así que de paso verifican lo que no se
 * debe ver: una barra de desplazamiento horizontal en pantalla angosta.
 */
const sinDesbordeHorizontal = async (page, ruta) => {
  const original = page.viewportSize();

  for (const ancho of ANCHOS_RESPONSIVE) {
    await page.setViewportSize({ width: ancho, height: 850 });
    await page.waitForTimeout(250);
    const { scroll, visible } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      visible: document.documentElement.clientWidth
    }));
    expect(scroll, `${ruta} desborda en horizontal a ${ancho} px`).toBeLessThanOrEqual(visible);
  }

  await page.setViewportSize(original);
};

test.describe('Capturas de escritorio', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  test('modo claro', async ({ page, request }) => {
    // La grilla distingue pendiente (rayado) de aprobada (macizo): la captura
    // necesita las dos en el mismo día para que la leyenda se entienda.
    const token = await obtenerToken(request, CREDENCIALES.usuario);
    await crearReservaApi(request, token, {
      aulaId: 1,
      fecha: DIA_GRILLA,
      horaInicio: '09:00',
      horaFin: '10:30',
      cantidadPersonas: 25,
      motivo: 'Parcial de Desarrollo de Software'
    });

    const aprobable = await crearReservaApi(request, token, {
      aulaId: 1,
      fecha: DIA_GRILLA,
      horaInicio: '14:00',
      horaFin: '16:00',
      cantidadPersonas: 30,
      motivo: 'Clase teórica de Bases de Datos'
    });
    const tokenAdmin = await obtenerToken(request, CREDENCIALES.admin);
    const aprobacion = await request.patch(`${URL_API}/reservas/${aprobable.id}/aprobar`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    expect(aprobacion.ok(), await aprobacion.text()).toBeTruthy();

    await page.goto('/login');
    await capturar(page, 'login-escritorio');

    await iniciarSesion(page, CREDENCIALES.admin);
    await sinDesbordeHorizontal(page, '/reservas');
    await capturar(page, 'agenda-escritorio');

    await usarVista(page, 'tabla');
    await expect(page.getByRole('table', { name: 'Listado de reservas' })).toBeVisible();
    await capturar(page, 'tabla-escritorio');
    await usarVista(page, 'agenda');

    await page.goto('/reservas/nueva');
    await expect(page.getByRole('heading', { name: 'Nueva reserva', level: 1 })).toBeVisible();
    await page.getByRole('textbox', { name: 'Fecha' }).fill(DIA_GRILLA);
    // Dos clics cierran el rango: así la captura muestra a la vez una franja
    // ocupada, una pendiente y la selección en curso.
    const grilla = page.getByRole('region', { name: 'Grilla de disponibilidad horaria' });
    await grilla.getByRole('button', { name: /Aula 910, 11:00 a 11:30, libre/i }).click();
    await grilla.getByRole('button', { name: /Aula 910, 12:00 a 12:30, libre/i }).click();
    await sinDesbordeHorizontal(page, '/reservas/nueva');
    await capturar(page, 'grilla-escritorio');

    await page.goto('/resumen');
    await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();
    await sinDesbordeHorizontal(page, '/resumen');
    await capturar(page, 'panel-escritorio');

    await page.goto('/reservas/1');
    await expect(page.getByRole('heading', { name: /Reserva #1/, level: 1 })).toBeVisible();
    await capturar(page, 'detalle-escritorio');

    await page.goto('/aulas');
    await expect(page.getByRole('heading', { name: 'Aulas', level: 1 })).toBeVisible();
    await sinDesbordeHorizontal(page, '/aulas');
    await capturar(page, 'aulas-escritorio');
  });

  test('modo oscuro', async ({ page }) => {
    await page.goto('/login');
    await usarTema(page, 'oscuro');
    await capturar(page, 'login-oscuro');

    await iniciarSesion(page, CREDENCIALES.admin);
    await capturar(page, 'agenda-oscuro');

    await page.goto('/reservas/nueva');
    await expect(page.getByRole('heading', { name: 'Nueva reserva', level: 1 })).toBeVisible();
    await page.getByRole('textbox', { name: 'Fecha' }).fill(DIA_GRILLA);
    await expect(
      page.getByRole('region', { name: 'Grilla de disponibilidad horaria' })
    ).toBeVisible();
    await capturar(page, 'grilla-oscuro');

    await page.goto('/resumen');
    await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();
    await capturar(page, 'panel-oscuro');
  });
});

test.describe('Capturas de teléfono', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  test('vistas principales en pantalla angosta', async ({ page }) => {
    await page.goto('/login');
    await capturar(page, 'login-movil');

    await iniciarSesion(page, CREDENCIALES.admin);
    await capturar(page, 'agenda-movil');

    await page.goto('/reservas/nueva');
    await expect(page.getByRole('heading', { name: 'Nueva reserva', level: 1 })).toBeVisible();
    await page.getByRole('textbox', { name: 'Fecha' }).fill(DIA_GRILLA);
    await expect(
      page.getByRole('region', { name: 'Grilla de disponibilidad horaria' })
    ).toBeVisible();
    await capturar(page, 'grilla-movil');

    await page.goto('/resumen');
    await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();
    await capturar(page, 'panel-movil');
  });
});

test.describe('Capturas de ancho intermedio', () => {
  test.use({ viewport: { width: 1024, height: 850 }, deviceScaleFactor: 2 });

  test('la barra lateral colapsa a un riel de iconos', async ({ page }) => {
    await iniciarSesion(page, CREDENCIALES.admin);
    await capturar(page, 'agenda-1024');
  });
});
