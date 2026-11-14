// El alta de cuentas la resuelve Clerk desde el frontend (ver docs/adr/0002):
// la API propia solo verifica credenciales para el JWT local, así que acá no
// hay `register`.
import api from './axios.js';

export const login = (email, password) => api.post('/auth/login', { email, password });
