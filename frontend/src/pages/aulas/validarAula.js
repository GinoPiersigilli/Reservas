/**
 * Validación del formulario de aulas, en el navegador.
 *
 * El backend valida lo mismo (y es la autoridad): esto solo evita un viaje al
 * servidor y muestra el error junto al campo. Los límites coinciden con los del
 * esquema de la base.
 */
const LIMITES = {
  nombre: 100,
  ubicacion: 120,
  capacidadMinima: 1,
  capacidadMaxima: 1000
};

const esCapacidadValida = (valor) => {
  const numero = Number(valor);
  return (
    Boolean(valor) &&
    Number.isInteger(numero) &&
    numero >= LIMITES.capacidadMinima &&
    numero <= LIMITES.capacidadMaxima
  );
};

export const validarAula = (formData) => {
  const errores = {};
  const nombre = formData.nombre.trim();
  const ubicacion = formData.ubicacion.trim();

  if (!nombre) {
    errores.nombre = 'El nombre del aula es obligatorio';
  } else if (nombre.length > LIMITES.nombre) {
    errores.nombre = `El nombre no puede superar los ${LIMITES.nombre} caracteres`;
  }

  if (!ubicacion) {
    errores.ubicacion = 'La ubicación del aula es obligatoria';
  } else if (ubicacion.length > LIMITES.ubicacion) {
    errores.ubicacion = `La ubicación no puede superar los ${LIMITES.ubicacion} caracteres`;
  }

  if (!esCapacidadValida(formData.capacidad)) {
    errores.capacidad = `La capacidad debe ser un número entero entre ${LIMITES.capacidadMinima} y ${LIMITES.capacidadMaxima}`;
  }

  return errores;
};

/** Datos listos para enviar a la API, sin espacios sobrantes. */
export const aulaParaEnviar = (formData) => ({
  nombre: formData.nombre.trim(),
  ubicacion: formData.ubicacion.trim(),
  capacidad: Number(formData.capacidad),
  recursos: formData.recursos.trim() || undefined
});

export const FORM_VACIO = { nombre: '', ubicacion: '', capacidad: '', recursos: '' };

/** Carga los datos de un aula existente en el formulario. */
export const formDesdeAula = (aula) => ({
  nombre: aula.nombre || '',
  ubicacion: aula.ubicacion || '',
  capacidad: String(aula.capacidad || ''),
  recursos: aula.recursos || ''
});
