import {
  HORA_FIN_JORNADA,
  HORA_INICIO_JORNADA,
  obtenerHoyArgentina
} from '../../config/horarios.js';

/**
 * Validación del formulario de reserva, en el navegador.
 *
 * Repite las reglas del backend, que es la autoridad: acá solo sirve para
 * mostrar el error junto al campo sin esperar la respuesta. La integridad de
 * los horarios la garantiza PostgreSQL (ver docs/adr/0001).
 */
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const esFechaValida = (fecha) => Boolean(fecha) && FORMATO_FECHA.test(fecha);

const validarFecha = (fecha) => {
  if (!esFechaValida(fecha)) return 'Ingrese una fecha válida.';
  if (fecha < obtenerHoyArgentina()) return 'No se permiten reservas en una fecha pasada.';
  return null;
};

const validarHorario = ({ horaInicio, horaFin }) => {
  const errores = {};

  if (!horaInicio) errores.horaInicio = 'Indique la hora de inicio.';
  if (!horaFin) errores.horaFin = 'Indique la hora de fin.';
  if (!horaInicio || !horaFin) return errores;

  if (horaInicio >= horaFin) {
    errores.horaFin = 'La hora de inicio debe ser menor a la hora de fin.';
  } else if (horaInicio < HORA_INICIO_JORNADA || horaFin > HORA_FIN_JORNADA) {
    errores.horaFin = `Las reservas solo se permiten entre las ${HORA_INICIO_JORNADA} y las ${HORA_FIN_JORNADA}.`;
  }

  return errores;
};

const validarCantidad = (cantidadPersonas, aulaSeleccionada) => {
  const numero = Number(cantidadPersonas);

  if (!cantidadPersonas || !Number.isInteger(numero) || numero < 1) {
    return 'Indique una cantidad entera mayor a 0.';
  }
  if (aulaSeleccionada && numero > aulaSeleccionada.capacidad) {
    return `La cantidad de personas supera la capacidad del aula (máx. ${aulaSeleccionada.capacidad}).`;
  }
  return null;
};

/**
 * Errores por campo, en el orden en que aparecen en el formulario: el primero
 * es el que se muestra además como aviso general.
 */
export const validarReserva = (form, aulaSeleccionada) => {
  const errores = {};

  if (!form.aulaId) errores.aulaId = 'Elija un aula.';

  const errorFecha = validarFecha(form.fecha);
  if (errorFecha) errores.fecha = errorFecha;

  Object.assign(errores, validarHorario(form));

  const errorCantidad = validarCantidad(form.cantidadPersonas, aulaSeleccionada);
  if (errorCantidad) errores.cantidadPersonas = errorCantidad;

  if (!form.motivo || !form.motivo.trim()) {
    errores.motivo = 'Ingrese el motivo de la reserva.';
  }

  return errores;
};

/** Paso del asistente según lo que ya se completó. */
export const pasoActual = (form) => {
  if (!form.fecha || !form.aulaId) return 1;
  if (!form.horaInicio || !form.horaFin) return 2;
  return 3;
};
