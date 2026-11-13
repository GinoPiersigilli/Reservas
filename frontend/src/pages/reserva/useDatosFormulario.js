import { useEffect, useState } from 'react';
import * as aulaService from '../../services/aula.service.js';
import { getReserva } from '../../services/reservas.service.js';
import { TEXTOS } from '../../textos.js';
import { esFechaValida } from './validarReserva.js';

const FORM_VACIO = {
  aulaId: '',
  fecha: '',
  horaInicio: '',
  horaFin: '',
  cantidadPersonas: '',
  motivo: ''
};

const formDesdeReserva = (reserva) => ({
  aulaId: String(reserva.aulaId),
  fecha: reserva.fecha,
  horaInicio: reserva.horaInicio,
  horaFin: reserva.horaFin,
  cantidadPersonas: String(reserva.cantidadPersonas),
  motivo: reserva.motivo
});

/**
 * Datos que el formulario necesita: las aulas activas, la reserva que se edita
 * (si corresponde) y la disponibilidad de cada aula en la fecha elegida.
 */
export const useDatosFormulario = ({ id, esEdicion }) => {
  const [form, setForm] = useState(FORM_VACIO);
  const [aulas, setAulas] = useState([]);
  const [aulaCargando, setAulaCargando] = useState(true);
  const [disponibilidadPorAula, setDisponibilidadPorAula] = useState({});
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  useEffect(() => {
    let cancelado = false;

    const cargarAulas = async () => {
      try {
        const res = await aulaService.getAulas();
        if (!cancelado) setAulas(res.data.filter((a) => a.activa));
      } catch {
        if (!cancelado) setErrorCarga(TEXTOS.aulas.errorCarga);
      } finally {
        if (!cancelado) setAulaCargando(false);
      }
    };

    const cargarReserva = async () => {
      try {
        const res = await getReserva(id);
        if (!cancelado) setForm(formDesdeReserva(res.data));
      } catch {
        if (!cancelado) setErrorCarga('No se pudo cargar la reserva. Intente de nuevo.');
      }
    };

    cargarAulas();
    if (esEdicion) cargarReserva();

    return () => {
      cancelado = true;
    };
  }, [id, esEdicion]);

  useEffect(() => {
    let cancelado = false;

    if (
      !esFechaValida(form.fecha) ||
      aulas.length === 0 ||
      typeof aulaService.getDisponibilidadAula !== 'function'
    ) {
      return undefined;
    }

    const cargarDisponibilidad = async () => {
      setCargandoDisponibilidad(true);
      try {
        // Una consulta por aula, en paralelo. Si una falla, esa aula se muestra
        // sin franjas en lugar de dejar la grilla entera sin datos.
        const resultados = await Promise.all(
          aulas.map((aula) =>
            Promise.resolve(aulaService.getDisponibilidadAula(aula.id, form.fecha))
              .then((res) => ({
                aulaId: aula.id,
                franjas: Array.isArray(res?.data) ? res.data : []
              }))
              .catch(() => ({ aulaId: aula.id, franjas: [] }))
          )
        );

        if (!cancelado) {
          setDisponibilidadPorAula(
            Object.fromEntries(resultados.map(({ aulaId, franjas }) => [aulaId, franjas]))
          );
        }
      } finally {
        if (!cancelado) setCargandoDisponibilidad(false);
      }
    };

    cargarDisponibilidad();

    return () => {
      cancelado = true;
    };
  }, [form.fecha, aulas]);

  return {
    form,
    setForm,
    aulas,
    aulaCargando,
    disponibilidadPorAula,
    cargandoDisponibilidad,
    errorCarga,
    setErrorCarga
  };
};

export default useDatosFormulario;
