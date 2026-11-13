import { useCallback, useEffect, useState } from 'react';
import { getResumen, getReservas } from '../../services/reservas.service.js';
import { getAulas } from '../../services/aula.service.js';
import { TEXTOS } from '../../textos.js';
import { extraerListado } from './metricasPanel.js';

/** Llamada opcional: si falla, se usa el valor de respaldo en lugar de cortar. */
const opcional = (fn, args, respaldo) =>
  typeof fn === 'function'
    ? Promise.resolve(fn(...args)).catch(() => respaldo)
    : Promise.resolve(respaldo);

/**
 * Datos del panel: métricas, cola de pendientes y nombres de aulas.
 *
 * Solo el resumen es imprescindible; si la cola o las aulas fallan, el panel se
 * muestra igual con lo que haya.
 */
export const usePanel = () => {
  const [resumen, setResumen] = useState(null);
  const [colaPendientes, setColaPendientes] = useState([]);
  const [nombresAulas, setNombresAulas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarPanel = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const [resResumen, resPendientes, resAulas] = await Promise.all([
        getResumen(),
        opcional(getReservas, [{ estado: 'pendiente', limit: 50, sortBy: 'fecha', order: 'ASC' }], {
          data: { data: [] }
        }),
        opcional(getAulas, [], { data: [] })
      ]);

      setResumen(resResumen.data);
      setColaPendientes(extraerListado(resPendientes));

      if (Array.isArray(resAulas?.data)) {
        setNombresAulas(Object.fromEntries(resAulas.data.map((a) => [a.id, a.nombre])));
      }
    } catch (err) {
      setError(err.response?.data?.error || TEXTOS.panel.errorCarga);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarPanel();
  }, [cargarPanel]);

  return { resumen, colaPendientes, nombresAulas, cargando, error, recargar: cargarPanel };
};

export default usePanel;
