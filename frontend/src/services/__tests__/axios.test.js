import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import api, {
  registrarGetToken,
  registrarOnUnauthorized,
  MENSAJE_SESION_EXPIRADA
} from '../axios.js';

describe('Interceptor de respuesta Axios (401)', () => {
  let originalLocation;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    registrarGetToken(null);
    registrarOnUnauthorized(null);

    originalLocation = window.location;
    delete window.location;
    window.location = {
      pathname: '/reservas',
      href: 'http://localhost/reservas'
    };
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('ante un 401 en ruta protegida limpia localStorage, llama al callback, guarda mensaje y redirige a /login', async () => {
    localStorage.setItem('token', 'mi-token-local');
    localStorage.setItem('usuario', JSON.stringify({ id: 1, email: 'test@example.com' }));

    const onUnauthorizedMock = vi.fn();
    registrarOnUnauthorized(onUnauthorizedMock);

    // Simular error 401 en interceptor de respuesta
    const error401 = {
      response: { status: 401 },
      config: { url: '/reservas', method: 'get' }
    };

    // Obtenemos el interceptor de respuesta de error registrado en api
    const responseInterceptor = api.interceptors.response.handlers[0].rejected;

    await expect(responseInterceptor(error401)).rejects.toBe(error401);

    // 1. Debe limpiar localStorage
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('usuario')).toBeNull();

    // 2. Debe invocar el callback de desautenticación
    expect(onUnauthorizedMock).toHaveBeenCalledTimes(1);

    // 3. Debe guardar el mensaje en sessionStorage
    expect(sessionStorage.getItem('auth_error')).toBe(MENSAJE_SESION_EXPIRADA);

    // 4. Debe redirigir a /login
    expect(window.location.href).toBe('/login');
  });

  it('no redirige ni limpia sesión si el 401 proviene de POST /auth/login', async () => {
    localStorage.setItem('token', 'token-previo');
    const onUnauthorizedMock = vi.fn();
    registrarOnUnauthorized(onUnauthorizedMock);

    const errorLogin = {
      response: { status: 401 },
      config: { url: '/auth/login', method: 'post' }
    };

    const responseInterceptor = api.interceptors.response.handlers[0].rejected;

    await expect(responseInterceptor(errorLogin)).rejects.toBe(errorLogin);

    expect(localStorage.getItem('token')).toBe('token-previo');
    expect(onUnauthorizedMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('auth_error')).toBeNull();
    expect(window.location.href).toBe('http://localhost/reservas');
  });

  it('evita bucles de redirección si ya se encuentra en la ruta /login', async () => {
    window.location.pathname = '/login';
    window.location.href = 'http://localhost/login';

    const onUnauthorizedMock = vi.fn();
    registrarOnUnauthorized(onUnauthorizedMock);

    const error401 = {
      response: { status: 401 },
      config: { url: '/aulas', method: 'get' }
    };

    const responseInterceptor = api.interceptors.response.handlers[0].rejected;

    await expect(responseInterceptor(error401)).rejects.toBe(error401);

    expect(onUnauthorizedMock).toHaveBeenCalledTimes(1);
    // No debe haber modificado href a '/login' porque ya estaba en '/login'
    expect(window.location.href).toBe('http://localhost/login');
  });

  it('agrega cabecera Authorization cuando registrarGetToken provee un token', async () => {
    registrarGetToken(() => Promise.resolve('token-prueba-123'));

    const requestInterceptor = api.interceptors.request.handlers[0].fulfilled;
    const config = { headers: {} };

    const result = await requestInterceptor(config);
    expect(result.headers.Authorization).toBe('Bearer token-prueba-123');
  });
});
