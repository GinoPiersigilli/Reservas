// src/controllers/aulas.controller.js
import * as aulasService from '../services/aulas.services.js';

export const listarAulas = async (req, res, next) => {
  try {
    // Llamamos al servicio que busca en la base de datos
    const aulas = await aulasService.obtenerAulasActivas();
    
    // Devolvemos el resultado al cliente con un status 200 (OK)
    res.status(200).json(aulas);
  } catch (error) {
    // Si la base de datos explota, le pasamos el error a tu middleware global del index.js
    next(error); 
  }
};