// src/controllers/aulas.controllers.js
import * as aulasService from '../services/aulas.services.js';

export const listarAulas = async (req, res, next) => {
  try {
    const aulas = await aulasService.obtenerAulas({
      usuario: req.usuario,
      incluirInactivas: req.query?.incluirInactivas
    });
    res.status(200).json(aulas);
  } catch (error) {
    next(error);
  }
};

export const obtenerDisponibilidadAula = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha } = req.query;
    const disponibilidad = await aulasService.obtenerDisponibilidadAula(id, fecha);
    res.status(200).json(disponibilidad);
  } catch (error) {
    next(error);
  }
};

export const crearAula = async (req, res, next) => {
  try {
    const nuevaAula = await aulasService.crearAula(req.body, req.usuario.id);
    res.status(201).json(nuevaAula);
  } catch (error) {
    next(error);
  }
};

export const editarAula = async (req, res, next) => {
  try {
    const { id } = req.params;
    const aulaActualizada = await aulasService.editarAula(Number(id), req.body, req.usuario.id);
    res.status(200).json(aulaActualizada);
  } catch (error) {
    next(error);
  }
};

export const desactivarAula = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resultado = await aulasService.desactivarAula(Number(id), req.body, req.usuario.id);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

export const reactivarAula = async (req, res, next) => {
  try {
    const { id } = req.params;
    const aulaReactivada = await aulasService.reactivarAula(Number(id), req.usuario.id);
    res.status(200).json(aulaReactivada);
  } catch (error) {
    next(error);
  }
};
