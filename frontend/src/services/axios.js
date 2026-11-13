import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
});

let _tokenFn = null;
let _onUnauthorizedFn = null;

export const registrarGetToken = (fn) => {
  _tokenFn = fn;
};
export const registrarOnUnauthorized = (fn) => {
  _onUnauthorizedFn = fn;
};

export const MENSAJE_SESION_EXPIRADA = 'Su sesión expiró o fue desactivada. Ingrese nuevamente.';

/**
 * Identificador de la petición. El backend lo respeta si es un UUID y lo
 * devuelve en la cabecera X-Request-Id, de modo que un problema reportado por
 * una persona pueda rastrearse en los logs del servidor.
 */
const nuevoRequestId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return null;
  }
};

api.interceptors.request.use(async (config) => {
  const requestId = nuevoRequestId();
  if (requestId) config.headers['X-Request-Id'] = requestId;

  try {
    if (_tokenFn) {
      const token = await _tokenFn();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Si falla la obtención del token, continuar sin Authorization
  }
  return config;
});

/** Una respuesta 401 del propio login es un error de credenciales, no una sesión vencida. */
const esRespuestaDeLogin = (error) => {
  const url = error.config?.url || '';
  const metodo = (error.config?.method || '').toLowerCase();
  return url.includes('/auth/login') && metodo === 'post';
};

/** Avisa al contexto de autenticación, sin dejar que su error tape el original. */
const notificarSesionCaida = async () => {
  if (typeof _onUnauthorizedFn !== 'function') return;
  try {
    await _onUnauthorizedFn();
  } catch {
    // Ignorar errores en el callback de cierre de sesión
  }
};

/** El mensaje sobrevive a la navegación para mostrarse en la pantalla de ingreso. */
const guardarMotivo = () => {
  try {
    sessionStorage.setItem('auth_error', MENSAJE_SESION_EXPIRADA);
  } catch {
    // sessionStorage puede estar deshabilitado
  }
};

const irALogin = () => {
  if (typeof window === 'undefined' || !window.location) return;
  if ((window.location.pathname || '') === '/login') return;
  window.location.href = '/login';
};

/**
 * Sesión vencida o revocada: se limpia todo lo local y se vuelve al ingreso con
 * el motivo a la vista, en lugar de dejar la pantalla con datos de una sesión
 * que ya no existe.
 */
const cerrarSesionPorNoAutorizado = async () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  registrarGetToken(null);

  await notificarSesionCaida();
  guardarMotivo();
  irALogin();
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !esRespuestaDeLogin(error)) {
      await cerrarSesionPorNoAutorizado();
    }

    return Promise.reject(error);
  }
);

export default api;
