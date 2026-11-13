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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const method = (error.config?.method || '').toLowerCase();

    const esLogin = url.includes('/auth/login') && method === 'post';

    if (status === 401 && !esLogin) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      registrarGetToken(null);

      if (typeof _onUnauthorizedFn === 'function') {
        try {
          await _onUnauthorizedFn();
        } catch {
          // Ignorar errores en callback de cierre de sesión
        }
      }

      try {
        sessionStorage.setItem('auth_error', MENSAJE_SESION_EXPIRADA);
      } catch {
        // Ignorar fallo de sessionStorage si está deshabilitado
      }

      if (typeof window !== 'undefined' && window.location) {
        const currentPath = window.location.pathname || '';
        if (currentPath !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
