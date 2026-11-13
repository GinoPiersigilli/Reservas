import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAulas } from '../../services/aula.service.js';
import { TEXTOS } from '../../textos.js';

/**
 * Listado de aulas con su filtro por estado.
 *
 * Siempre se piden también las inactivas (la pantalla es de administración) y
 * el filtro se aplica en memoria, así cambiar de pestaña no vuelve a consultar.
 */
export const useAulas = () => {
  const [aulas, setAulas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todas');

  const cargarAulas = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await getAulas(true);
      setAulas(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setErrorCarga(TEXTOS.aulas.errorCarga);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarAulas();
  }, [cargarAulas]);

  const aulasFiltradas = useMemo(() => {
    if (filtroEstado === 'activas') return aulas.filter((a) => a.activa);
    if (filtroEstado === 'inactivas') return aulas.filter((a) => !a.activa);
    return aulas;
  }, [aulas, filtroEstado]);

  const conteos = useMemo(
    () => ({
      todas: aulas.length,
      activas: aulas.filter((a) => a.activa).length,
      inactivas: aulas.filter((a) => !a.activa).length
    }),
    [aulas]
  );

  return {
    aulas,
    aulasFiltradas,
    conteos,
    cargando,
    errorCarga,
    recargar: cargarAulas,
    filtroEstado,
    setFiltroEstado
  };
};

export default useAulas;
