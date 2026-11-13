import { Check } from 'lucide-react';
import { TEXTOS } from '../../textos.js';
import styles from '../FormularioReserva.module.css';

const PASOS = [
  { numero: 1, etiqueta: TEXTOS.formulario.paso1, destino: 'paso-fecha-aula' },
  { numero: 2, etiqueta: TEXTOS.formulario.paso2, destino: 'paso-franja-horaria' },
  { numero: 3, etiqueta: TEXTOS.formulario.paso3, destino: 'paso-datos' }
];

/**
 * Avance y navegación: los tres bloques del formulario están siempre visibles,
 * así que cada paso es además el enlace que lleva a su bloque.
 */
export default function PasosReserva({ pasoActual }) {
  return (
    <ol className={styles.pasos} aria-label="Pasos para reservar">
      {PASOS.map(({ numero, etiqueta, destino }) => {
        const completado = pasoActual > numero;

        return (
          <li
            key={numero}
            className={[
              styles.pasoItem,
              pasoActual === numero ? styles.pasoActivo : '',
              completado ? styles.pasoCompletado : ''
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={pasoActual === numero ? 'step' : undefined}
          >
            <a href={`#${destino}`} className={styles.enlacePaso}>
              <span className={styles.numeroPaso}>
                {completado ? <Check size={14} aria-hidden="true" /> : String(numero)}
              </span>
              <span>{etiqueta}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
