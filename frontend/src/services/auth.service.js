import api from './axios.js';

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const register = (nombre, email, password) =>
  api.post('/auth/register', { nombre, email, password });