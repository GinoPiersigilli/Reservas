import { TEXTOS } from '../../textos.js';
import styles from '../Aulas.module.css';

const OPCIONES = [
  { clave: 'todas', etiqueta: TEXTOS.aulas.filtroTodas },
  { clave: 'activas', etiqueta: TEXTOS.aulas.filtroActivas },
  { clave: 'inactivas', etiqueta: TEXTOS.aulas.filtroInactivas }
];

/** Filtro por estado del aula, con la cantidad de cada grupo. */
export default function FiltrosAulas({ filtroEstado, conteos, onCambiar }) {
  return (
    <div className={styles.barraControles}>
      <div className={styles.filtros} role="group" aria-label="Filtro de aulas por estado">
        {OPCIONES.map(({ clave, etiqueta }) => {
          const activo = filtroEstado === clave;
          return (
            <button
              key={clave}
              type="button"
              className={[styles.botonFiltro, activo ? styles.botonFiltroActivo : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => onCambiar(clave)}
              aria-pressed={activo}
            >
              {etiqueta} ({conteos[clave]})
            </button>
          );
        })}
      </div>
    </div>
  );
}
