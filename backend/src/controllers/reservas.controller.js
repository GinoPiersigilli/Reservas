// src/controllers/reservas.controller.js
import * as reservasService from '../services/reservas.services.js';

export const crearReserva = async (req, res, next) => {
  try {
    // 1. Extraemos los datos que el frontend mandó en el body
    const datosReserva = req.body;
    
    // (Opcional por ahora: sacar el usuarioId del token JWT en lugar del body)
    // datosReserva.usuarioId = req.usuario.id; 

    // 2. Le pasamos los datos puros al servicio para que aplique las reglas de negocio
    const nuevaReserva = await reservasService.crearNuevaReserva(datosReserva);

    // 3. Si todo salió bien, respondemos con status 201 (Creado) [cite: 119]
    res.status(201).json(nuevaReserva);

  } catch (error) {
    // 4. Si el servicio tiró un error (ej: "La cantidad de personas supera la capacidad")
    // Lo atrapamos acá y devolvemos un status 400 (Bad Request) con el JSON que pide la cátedra [cite: 188]
    res.status(400).json({ error: error.message });
  }
};

// Acá irían el resto de las funciones: listarReservas, cancelarReserva, etc.