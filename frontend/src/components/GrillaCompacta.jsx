import styles from './GrillaDisponibilidad.module.css';

const clases = (...valores) => valores.filter(Boolean).join(' ');

/** Selector de aula cuando hay más de una; en pantallas chicas se ve una por vez. */
function TabsAulas({ aulas, aulaActiva, onElegirAula }) {
  if (aulas.length <= 1) return null;

  return (
    <div className={styles.tabsAulasCompactas} role="tablist" aria-label="Aulas disponibles">
      {aulas.map((aula) => {
        const esActiva = String(aula.id) === String(aulaActiva?.id);
        return (
          <button
            key={aula.id}
            type="button"
            role="tab"
            aria-selected={esActiva}
            className={clases(styles.tabAulaCompacta, esActiva && styles.tabAulaCompactaActiva)}
            onClick={() => onElegirAula(aula)}
          >
            {aula.nombre}
          </button>
        );
      })}
    </div>
  );
}

function ListaOcupadas({ ocupadas }) {
  if (ocupadas.length === 0) {
    return (
      <p className={styles.textoVacioCompacto}>
        Sin reservas en esta fecha (aula libre durante toda la jornada).
      </p>
    );
  }

  return (
    <ul className={styles.listaOcupadasCompacta}>
      {ocupadas.map((oc, idx) => {
        const esPendiente = oc.estado === 'pendiente';
        return (
          <li
            key={`${oc.rangoTexto}-${idx}`}
            className={clases(
              styles.itemOcupadaCompacta,
              esPendiente ? styles.itemOcupadaPendiente : styles.itemOcupadaAprobada
            )}
          >
            <span
              className={clases(
                styles.muestraMuesca,
                esPendiente ? styles.muestraPendiente : styles.muestraAprobada
              )}
              aria-hidden="true"
            />
            <span>
              Ocupada {oc.rangoTexto}, {oc.nombreEstado.toLowerCase()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ListaLibres({ libres, aulaActiva, seleccion, onElegirTramo }) {
  if (libres.length === 0) {
    return (
      <p className={styles.textoVacioCompacto}>No hay tramos libres disponibles para esta fecha.</p>
    );
  }

  return (
    <ul className={styles.listaLibresCompacta}>
      {libres.map((tramo) => {
        const esSeleccionado = Boolean(
          String(seleccion.aulaId) === String(aulaActiva.id) &&
            seleccion.horaInicio === tramo.horaInicio &&
            seleccion.horaFin === tramo.horaFin
        );

        return (
          <li key={`${tramo.horaInicio}-${tramo.horaFin}`}>
            <button
              type="button"
              className={clases(
                styles.botonTramoLibre,
                esSeleccionado && styles.botonTramoSeleccionado
              )}
              onClick={() => onElegirTramo(tramo)}
              aria-label={`${aulaActiva.nombre}, libre de ${tramo.horaInicio} a ${tramo.horaFin}`}
              aria-pressed={esSeleccionado}
            >
              <span className={styles.etiquetaTramoLibre}>
                Libre {tramo.horaInicio}–{tramo.horaFin}
              </span>
              <span className={styles.accionTramoLibre}>
                {esSeleccionado ? 'Seleccionado' : 'Elegir tramo'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Vista para tablet y móvil (< 1100 px): en vez de una grilla de 28 columnas,
 * muestra un aula por vez con sus franjas ocupadas y sus tramos libres
 * agrupados, que al tocarlos prellenan el horario.
 */
export default function GrillaCompacta({
  aulas,
  aulaActiva,
  tramos,
  hayFecha,
  seleccion,
  onElegirAula,
  onElegirTramo
}) {
  if (!hayFecha) return <div className={styles.vistaCompacta} />;

  return (
    <div className={styles.vistaCompacta}>
      <TabsAulas aulas={aulas} aulaActiva={aulaActiva} onElegirAula={onElegirAula} />

      {aulaActiva && tramos ? (
        <article className={styles.tarjetaAulaCompacta}>
          <header className={styles.encabezadoAulaCompacta}>
            <h3 className={styles.nombreAulaCompacta}>{aulaActiva.nombre}</h3>
            <p className={styles.metaAulaCompacta}>
              Capacidad: {aulaActiva.capacidad} personas
              {aulaActiva.ubicacion ? ` · ${aulaActiva.ubicacion}` : ''}
            </p>
          </header>

          <div className={styles.seccionOcupadasCompacta}>
            <h4 className={styles.subtituloCompacto}>Franjas ocupadas</h4>
            <ListaOcupadas ocupadas={tramos.ocupadas} />
          </div>

          <div className={styles.seccionLibresCompacta}>
            <h4 className={styles.subtituloCompacto}>
              Tramos libres agrupados (toque para prellenar horario)
            </h4>
            <ListaLibres
              libres={tramos.libres}
              aulaActiva={aulaActiva}
              seleccion={seleccion}
              onElegirTramo={onElegirTramo}
            />
          </div>
        </article>
      ) : null}
    </div>
  );
}
