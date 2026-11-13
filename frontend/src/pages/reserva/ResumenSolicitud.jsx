import { calcularDuracionTexto, formatearFecha } from '../../utils/formato.js';
import styles from '../FormularioReserva.module.css';

/**
 * Lo elegido hasta el momento, en una línea legible.
 *
 * Es una región `aria-live`: al elegir una franja en la grilla, un lector de
 * pantalla anuncia el cambio sin que el foco se mueva.
 */
export default function ResumenSolicitud({ form, aulaSeleccionada }) {
  const duracion = calcularDuracionTexto(form.horaInicio, form.horaFin);

  const franja =
    form.horaInicio && form.horaFin
      ? `${form.horaInicio} a ${form.horaFin}${duracion ? ` (${duracion})` : ''}`
      : 'Sin franja horaria';

  return (
    <div className={styles.resumenSeleccion} aria-live="polite">
      <span className={styles.tituloResumen}>Resumen de la solicitud</span>
      <p className={styles.lineaResumen}>
        Seleccionado: {aulaSeleccionada ? aulaSeleccionada.nombre : 'Sin aula elegida'} ·{' '}
        {form.fecha ? formatearFecha(form.fecha) : 'Sin fecha'} · {franja}
      </p>
      {form.cantidadPersonas || form.motivo ? (
        <p className={styles.detalleResumen}>
          {form.cantidadPersonas ? `${form.cantidadPersonas} personas` : ''}
          {form.cantidadPersonas && form.motivo ? ' · ' : ''}
          {form.motivo || ''}
        </p>
      ) : null}
    </div>
  );
}
