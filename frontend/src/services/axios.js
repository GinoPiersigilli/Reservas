import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
});

let _tokenFn = null;

export const registrarGetToken = (fn) => { _tokenFn = fn; };

api.interceptors.request.use(async (config) => {
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

export default api;