import { useCallback, useEffect, useState } from 'react';
import { getAulas } from '../../services/aula.service.js';
import { getHistorial, getReserva } from '../../services/reservas.service.js';

/**
 * Reserva, historial y nombres de aulas, en una sola carga.
 *
 * Las aulas solo se usan para mostrar el nombre cuando la API no lo incluye en
 * la reserva, así que si esa consulta falla no se considera un error: la ficha
 * se muestra igual con el identificador del aula.
 */
export const useReservaDetalle = (id) => {
  const [reserva, setReserva] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [nombresAulas, setNombresAulas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);

    const promesaAulas =
      typeof getAulas === 'function'
        ? Promise.resolve(getAulas()).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] });

    try {
      const [resReserva, resHistorial, resAulas] = await Promise.all([
        getReserva(id),
        getHistorial(id),
        promesaAulas
      ]);

      setReserva(resReserva.data);
      setHistorial(resHistorial.data || []);

      if (Array.isArray(resAulas?.data)) {
        setNombresAulas(Object.fromEntries(resAulas.data.map((a) => [a.id, a.nombre])));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la reserva.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  return { reserva, historial, nombresAulas, cargando, error, recargar: cargarDatos };
};

export default useReservaDetalle;
