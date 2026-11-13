import { Check } from 'lucide-react';
import { TEXTOS } from '../../textos.js';
import styles from '../FormularioReserva.module.css';

const PASOS = [
  { numero: 1, etiqueta: TEXTOS.formulario.paso1 },
  { numero: 2, etiqueta: TEXTOS.formulario.paso2 },
  { numero: 3, etiqueta: TEXTOS.formulario.paso3 }
];

/** Indicador de avance: fecha y aula, horario, y datos de la solicitud. */
export default function PasosReserva({ pasoActual }) {
  return (
    <ol className={styles.pasos} aria-label="Pasos para reservar">
      {PASOS.map(({ numero, etiqueta }) => {
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
            <span className={styles.numeroPaso}>
              {completado ? <Check size={14} aria-hidden="true" /> : String(numero)}
            </span>
            <span>{etiqueta}</span>
          </li>
        );
      })}
    </ol>
  );
}
