import { TEXTOS } from '../../textos.js';
import styles from '../Aulas.module.css';

/**
 * Los recursos llegan como una cadena separada por comas. Se muestran como
 * etiquetas sueltas: así se leen de a uno y el ancho de la columna no depende
 * de cómo los haya tipeado quien cargó el aula.
 */
export default function ListaRecursos({ recursos }) {
  const items = String(recursos || '')
    .split(',')
    .map((recurso) => recurso.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return <span className={styles.sinRecursos}>{TEXTOS.aulas.sinRecursos}</span>;
  }

  return (
    <ul className={styles.listaRecursos}>
      {items.map((recurso) => (
        <li key={recurso} className={styles.recurso}>
          {recurso}
        </li>
      ))}
    </ul>
  );
}
