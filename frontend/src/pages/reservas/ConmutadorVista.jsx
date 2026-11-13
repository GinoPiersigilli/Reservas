import { CalendarDays, Table2 } from 'lucide-react';
import styles from './ConmutadorVista.module.css';

const OPCIONES = [
  { valor: 'agenda', etiqueta: 'Agenda', Icono: CalendarDays },
  { valor: 'tabla', etiqueta: 'Tabla', Icono: Table2 }
];

/** Elige cómo se listan las reservas: por jornada o como tabla ordenable. */
export default function ConmutadorVista({ vista, onCambiar }) {
  return (
    <div className={styles.grupo} role="group" aria-label="Formato del listado">
      {OPCIONES.map(({ valor, etiqueta, Icono }) => {
        const activa = vista === valor;
        return (
          <button
            key={valor}
            type="button"
            className={[styles.opcion, activa ? styles.opcionActiva : ''].filter(Boolean).join(' ')}
            aria-pressed={activa}
            onClick={() => onCambiar(valor)}
          >
            <Icono size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}
