// El alta de cuentas la resuelve Clerk desde el frontend (ver docs/adr/0002):
// la API propia solo verifica credenciales para el JWT local, así que acá no
// hay `register`.
import api from './axios.js';

export const login = (email, password) => api.post('/auth/login', { email, password });

/**
 * Quién es el portador del token, según la base propia.
 *
 * Hace falta para las sesiones de Clerk: de su token salen la cadena `user_2…`
 * y el rol de `publicMetadata`, y ninguno de los dos sirve para comparar contra
 * los datos de la aplicación, donde las reservas referencian la clave primaria
 * entera de `usuarios` y el rol que manda es el de PostgreSQL.
 */
export const obtenerPerfil = () => api.get('/auth/me');
