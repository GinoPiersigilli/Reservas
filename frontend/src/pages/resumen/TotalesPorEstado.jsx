import { TEXTOS } from '../../textos.js';
import { ETIQUETAS_ESTADO } from './metricasPanel.js';
import styles from '../Resumen.module.css';

/** Cantidad y porcentaje de reservas en cada estado. */
export default function TotalesPorEstado({ distribucionEstados, totalReservas }) {
  return (
    <section className={styles.bloqueCompacto} aria-labelledby="titulo-totales-estado">
      <h2 id="titulo-totales-estado" className={styles.tituloSeccion}>
        {TEXTOS.panel.totalesEstado}
      </h2>
      <dl className={styles.listaCompacta}>
        {distribucionEstados.map((item) => (
          <div key={item.estado} className={styles.filaCompacta}>
            <dt className={styles.etiquetaCompacta}>
              {ETIQUETAS_ESTADO[item.estado] || item.estado}
            </dt>
            <dd className={styles.valorCompacto}>
              {item.cantidad}
              <span className={styles.porcentajeTexto}>({item.porcentaje}%)</span>
            </dd>
          </div>
        ))}
        <div className={styles.filaCompacta}>
          <dt className={[styles.etiquetaCompacta, styles.etiquetaTotal].join(' ')}>Total</dt>
          <dd className={styles.valorCompacto}>{totalReservas}</dd>
        </div>
      </dl>
    </section>
  );
}
