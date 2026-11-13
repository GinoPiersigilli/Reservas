import { EstadoBadge } from '../../components/ui/index.js';
import styles from '../GuiaEstilos.module.css';

export default function SeccionEstados() {
  return (
    <section className={styles.seccion} aria-labelledby="sec-estados">
      <div className={styles.cabeceraSeccion}>
        <h2 id="sec-estados">Indicadores de estado (EstadoBadge)</h2>
        <p className={styles.descripcionSeccion}>
          Siempre combinan ícono, texto y color con contraste AA verificado.
        </p>
      </div>
      <div className={styles.fila}>
        <EstadoBadge estado="pendiente" />
        <EstadoBadge estado="aprobada" />
        <EstadoBadge estado="rechazada" />
        <EstadoBadge estado="cancelada" />
      </div>
    </section>
  );
}
