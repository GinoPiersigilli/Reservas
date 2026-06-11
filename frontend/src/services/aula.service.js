import api from './axios.js';

export const getAulas = () =>
  api.get('/aulas');