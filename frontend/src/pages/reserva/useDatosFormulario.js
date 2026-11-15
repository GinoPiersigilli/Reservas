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

    if (!esFechaValida(form.fecha) || aulas.length === 0) return undefined;
    if (typeof aulaService.getDisponibilidadDeTodas !== 'function') return undefined;

    const cargarDisponibilidad = async () => {
      setCargandoDisponibilidad(true);
      try {
        const res = await aulaService.getDisponibilidadDeTodas(form.fecha);
        if (cancelado) return;

        const porAula = {};
        (Array.isArray(res?.data) ? res.data : []).forEach(({ aulaId, franjas }) => {
          // En edición, la reserva que se está moviendo no se ocupa a sí misma:
          // si se contara, la grilla no dejaría extenderla ni correrla un rato.
          porAula[aulaId] = (Array.isArray(franjas) ? franjas : []).filter(
            (franja) => !(esEdicion && id != null && String(franja.id) === String(id))
          );
        });

        setDisponibilidadPorAula(porAula);
        setErrorCarga(null);
      } catch {
        // Antes cada aula que fallaba se mostraba «sin franjas», que en la
        // grilla se ve igual que «libre»: la pantalla invitaba a reservar un
        // horario que podía estar ocupado. Mejor decir que no se pudo saber.
        // `null`, no `{}`: un objeto vacío significa «consultado y sin nada
        // ocupado», que la grilla dibuja como todo libre. Es justamente la
        // mentira que este arreglo viene a sacar.
        if (!cancelado) {
          setDisponibilidadPorAula(null);
          setErrorCarga(TEXTOS.formulario.errorDisponibilidad);
        }
      } finally {
        if (!cancelado) setCargandoDisponibilidad(false);
      }
    };

    cargarDisponibilidad();

    return () => {
      cancelado = true;
    };
  }, [form.fecha, aulas, esEdicion, id]);

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
