import { expect } from '@playwright/test';

export const URL_API = 'http://localhost:3101/api';

export const CREDENCIALES = {
  admin: { email: 'admin@utnfrc.edu.ar', password: 'admin123', nombre: 'Administrador Bedelía' },
  usuario: { email: 'david@utnfrc.edu.ar', password: 'user123', nombre: 'David López' }
};

/** Fecha en formato YYYY-MM-DD a N días de hoy, en la zona horaria de Córdoba. */
export const fechaEnDias = (dias) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  const fecha = new Date(Date.UTC(Number(mapa.year), Number(mapa.month) - 1, Number(mapa.day)));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

/** Inicia sesión por la interfaz y espera el listado de reservas. */
export const iniciarSesion = async (page, { email, password }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/reservas$/);
};

/** Obtiene un token JWT local llamando a la API (para preparar datos de prueba). */
export const obtenerToken = async (request, { email, password }) => {
  const res = await request.post(`${URL_API}/auth/login`, { data: { email, password } });
  expect(res.ok(), 'el inicio de sesión por API debe funcionar').toBeTruthy();
  return (await res.json()).token;
};

/** Crea una reserva por API y devuelve su cuerpo (precondición de pruebas). */
export const crearReservaApi = async (request, token, datos) => {
  const res = await request.post(`${URL_API}/reservas`, {
    headers: { Authorization: `Bearer ${token}` },
    data: datos
  });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
};

/**
 * Datos de una reserva válida. Cada prueba indica su propio `dia` (días desde
 * hoy) para no competir por la misma franja con otras pruebas: los archivos se
 * ejecutan en procesos distintos y comparten la misma base de datos.
 */
export const datosReserva = ({ dia, ...overrides } = {}) => {
  if (typeof dia !== 'number') {
    throw new Error('datosReserva requiere un día propio para evitar colisiones entre pruebas');
  }
  return {
    aulaId: 3,
    fecha: fechaEnDias(dia),
    horaInicio: '09:00',
    horaFin: '10:00',
    cantidadPersonas: 10,
    motivo: `Reserva de prueba E2E (día +${dia})`,
    ...overrides
  };
};
