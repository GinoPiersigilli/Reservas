import styles from '../Resumen.module.css';

/**
 * Ocupación mensual por aula: horas reservadas sobre las horas operativas del
 * mes (ver el cálculo en el servicio del backend).
 */
export default function OcupacionAulas({ tasaOcupacion, totalReservas }) {
  if (tasaOcupacion.length === 0) return null;

  return (
    <section className={styles.seccion} aria-labelledby="titulo-analitica-ocupacion">
      <div className={styles.cabeceraSeccion}>
        <h2 id="titulo-analitica-ocupacion" className={styles.tituloSeccion}>
          Métricas de gestión y ocupación mensual
        </h2>
        <span className={styles.contador}>{totalReservas} reservas analizadas</span>
      </div>

      <div className={styles.grillaMetricas}>
        {tasaOcupacion.map((item) => (
          <article key={item.aulaId} className={styles.tarjetaMetrica}>
            <div className={styles.cabeceraTarjetaMetrica}>
              <span className={styles.nombreAula}>{item.nombre}</span>
              <span className={styles.tasaValor}>{item.tasaOcupacion}%</span>
            </div>
            <progress
              className={styles.progresoOcupacion}
              value={item.tasaOcupacion}
              max="100"
              aria-label={`Tasa de ocupación de ${item.nombre}: ${item.tasaOcupacion}%`}
            >
              {item.tasaOcupacion}%
            </progress>
            <div className={styles.pieTarjetaMetrica}>
              <span>{item.horasOcupadas} hs reservadas</span>
              {item.capacidad ? <span>Cap. {item.capacidad} pers.</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
