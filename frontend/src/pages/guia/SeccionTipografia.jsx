import styles from '../GuiaEstilos.module.css';

export default function SeccionTipografia() {
  return (
    <section className={styles.seccion} aria-labelledby="sec-tipografia">
      <div className={styles.cabeceraSeccion}>
        <h2 id="sec-tipografia">Tipografía y escala</h2>
        <p className={styles.descripcionSeccion}>
          Source Serif 4 (600) para títulos y Public Sans (400, 500, 600) para interfaz y tablas.
        </p>
      </div>
      <div className={styles.muestraTipografia}>
        <h1>Título de página (28 px — Source Serif 4)</h1>
        <h2>Título de sección (20 px — Source Serif 4)</h2>
        <h3>Subtítulo de bloque (16 px — Public Sans Semibold)</h3>
        <p className={styles.textoBase16}>
          Texto de formulario y lectura principal (16 px — Public Sans Regular). Largo de línea
          limitado a 70 caracteres para facilitar la lectura en paneles anchos.
        </p>
        <p className={styles.textoTabla14}>
          Texto denso de tabla y controles (14 px) con números tabulares: 08:00–10:00 · 12/11/2026 ·
          #25.
        </p>
        <p className={styles.textoAuxiliar13}>
          Texto auxiliar, etiquetas secundarias y notas al pie (13 px).
        </p>
      </div>
    </section>
  );
}
