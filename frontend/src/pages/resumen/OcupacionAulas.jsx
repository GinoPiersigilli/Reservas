import { ETIQUETAS_ESTADO } from './metricasPanel.js';
import styles from '../Resumen.module.css';

/** Barra apilada con la proporción de reservas en cada estado. */
function ComposicionPorEstado({ distribucionEstados, totalReservas }) {
  const conDatos = distribucionEstados.filter((item) => item.cantidad > 0);
  if (conDatos.length === 0) return null;

  return (
    <div className={styles.bloqueEstados}>
      <div className={styles.barraEstados} aria-hidden="true">
        {conDatos.map((item) => (
          <span
            key={item.estado}
            className={styles.segmentoEstado}
            data-estado={item.estado}
            style={{ flexGrow: item.cantidad }}
          />
        ))}
      </div>

      <dl className={styles.leyendaEstados}>
        {distribucionEstados.map((item) => (
          <div key={item.estado} className={styles.itemLeyenda}>
            <dt className={styles.etiquetaLeyenda}>
              <span className={styles.marcaLeyenda} data-estado={item.estado} aria-hidden="true" />
              {ETIQUETAS_ESTADO[item.estado] || item.estado}
            </dt>
            <dd className={styles.valorLeyenda}>{item.cantidad}</dd>
          </div>
        ))}
        <div className={styles.itemLeyenda}>
          <dt className={styles.etiquetaLeyenda}>Total</dt>
          <dd className={styles.valorLeyenda}>{totalReservas}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Ocupación mensual por aula: horas reservadas sobre las horas operativas del
 * mes (ver el cálculo en el servicio del backend).
 *
 * Una sola lista de barras, para que se puedan comparar entre sí, con la
 * cantidad de reservas de cada aula en la misma fila y la composición por
 * estado al pie.
 */
export default function OcupacionAulas({ ocupacion, distribucionEstados, totalReservas }) {
  if (ocupacion.length === 0 && totalReservas === 0) return null;

  return (
    <section className={styles.seccion} aria-labelledby="titulo-analitica-ocupacion">
      <div className={styles.cabeceraSeccion}>
        <h2 id="titulo-analitica-ocupacion" className={styles.tituloSeccion}>
          Ocupación del mes
        </h2>
        <span className={styles.contador}>
          {totalReservas} {totalReservas === 1 ? 'reserva analizada' : 'reservas analizadas'}
        </span>
      </div>

      <div className={styles.panelOcupacion}>
        {ocupacion.length > 0 ? (
          <ul className={styles.listaOcupacion}>
            {ocupacion.map((item) => (
              <li key={item.aulaId} className={styles.filaOcupacion}>
                <span className={styles.nombreAula}>{item.nombre}</span>

                <span className={styles.carrilOcupacion}>
                  <span
                    className={styles.relleno}
                    style={{ inlineSize: `${Math.max(item.tasaOcupacion, 1)}%` }}
                    aria-hidden="true"
                  />
                </span>

                <span className={styles.detalleOcupacion}>
                  {item.horasOcupadas} h en {item.totalReservas}{' '}
                  {item.totalReservas === 1 ? 'reserva' : 'reservas'}
                </span>

                <span className={styles.cifraOcupacion}>{item.tasaOcupacion}%</span>
              </li>
            ))}
          </ul>
        ) : null}

        <ComposicionPorEstado
          distribucionEstados={distribucionEstados}
          totalReservas={totalReservas}
        />
      </div>
    </section>
  );
}
