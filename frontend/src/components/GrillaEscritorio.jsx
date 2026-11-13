import { generarCabecerasHoras, horaAMinutos } from '../config/horarios.js';
import { TEXTOS } from '../textos.js';
import { BLOQUES } from './grillaCalculos.js';
import styles from './GrillaDisponibilidad.module.css';

const CABECERAS_HORAS = generarCabecerasHoras();

const clases = (...valores) => valores.filter(Boolean).join(' ');

/** Columna de la hora en curso, para resaltarla. */
const esHoraEnCurso = (hora, { esHoy, minutosAhora }) => {
  if (!esHoy) return false;
  const minHora = horaAMinutos(hora);
  return minutosAhora >= minHora && minutosAhora < minHora + 60;
};

function Cabecera({ reloj }) {
  return (
    <thead className={styles.theadEscritorio}>
      <tr>
        <th scope="col" className={styles.thAula}>
          Aula
        </th>
        {CABECERAS_HORAS.map((h) => (
          <th
            key={h.hora}
            scope="col"
            colSpan={2}
            className={clases(styles.thHora, esHoraEnCurso(h.hora, reloj) && styles.thHoraAhora)}
          >
            {h.hora}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function CeldaAula({ aula }) {
  const ubicacion = aula.ubicacion ? ` · ${aula.ubicacion}` : '';

  return (
    <td className={styles.tdAula} title={`${aula.nombre}${ubicacion} (Cap. ${aula.capacidad})`}>
      <span className={styles.nombreAula} title={aula.nombre}>
        {aula.nombre}
      </span>
      <span className={styles.metaAula}>
        Cap. {aula.capacidad}
        {ubicacion}
      </span>
    </td>
  );
}

/** Franja ya reservada: se muestra como un bloque deshabilitado con su rango. */
function CeldaOcupada({ segmento, aula, filaIdx, reloj }) {
  const { ocupacion, colIdx, span } = segmento;
  const esPendiente = ocupacion.estado === 'pendiente';
  const nombreEstado = esPendiente ? TEXTOS.estados.pendiente : TEXTOS.estados.aprobada;
  const rangoInicio = ocupacion.horaInicio.slice(0, 5);
  const rangoFin = ocupacion.horaFin.slice(0, 5);

  const esBloqueAhora = Boolean(
    reloj.esHoy &&
      reloj.minutosAhora >= horaAMinutos(rangoInicio) &&
      reloj.minutosAhora < horaAMinutos(rangoFin)
  );

  return (
    <td
      colSpan={span}
      className={clases(
        styles.tdCelda,
        styles.tdOcupada,
        colIdx % 2 === 0 ? styles.tdBordeHora : styles.tdBordeMedia,
        esBloqueAhora && styles.tdCeldaAhora
      )}
    >
      <button
        type="button"
        disabled
        data-fila={filaIdx}
        data-col={colIdx}
        aria-label={`${aula.nombre}, ${rangoInicio} a ${rangoFin}, ocupada (${nombreEstado})`}
        className={clases(
          styles.bloqueOcupado,
          esPendiente ? styles.bloquePendiente : styles.bloqueAprobado
        )}
      >
        <span className={styles.textoRangoOcupado}>{`${rangoInicio}–${rangoFin}`}</span>
      </button>
    </td>
  );
}

const ESTADOS_LIBRE = {
  pasado: { clase: styles.celdaPasada, texto: 'horario pasado' },
  seleccionado: { clase: styles.celdaSeleccionada, texto: 'seleccionado' },
  libre: { clase: styles.celdaLibre, texto: 'libre' }
};

const estadoDeCeldaLibre = (segmento) => {
  if (segmento.esPasado) return ESTADOS_LIBRE.pasado;
  if (segmento.estaSeleccionada) return ESTADOS_LIBRE.seleccionado;
  return ESTADOS_LIBRE.libre;
};

/** Franja disponible: botón seleccionable, salvo que ya haya pasado. */
function CeldaLibre({ segmento, aula, filaIdx, reloj, cargando, onSeleccionar, onKeyDown }) {
  const { bloque, colIdx, estaSeleccionada, esPasado } = segmento;
  const { clase, texto } = estadoDeCeldaLibre(segmento);

  const esBloqueAhora = Boolean(
    reloj.esHoy && reloj.minutosAhora >= bloque.inicioMin && reloj.minutosAhora < bloque.finMin
  );

  return (
    <td
      className={clases(
        styles.tdCelda,
        styles.tdLibre,
        colIdx % 2 === 0 ? styles.tdBordeHora : styles.tdBordeMedia,
        esBloqueAhora && styles.tdCeldaAhora
      )}
    >
      <button
        type="button"
        data-fila={filaIdx}
        data-col={colIdx}
        data-celda={`${filaIdx}-${colIdx}`}
        disabled={Boolean(cargando || esPasado)}
        aria-label={`${aula.nombre}, ${bloque.inicio} a ${bloque.fin}, ${texto}`}
        aria-pressed={estaSeleccionada}
        className={clases(styles.celdaBoton, clase)}
        onClick={() => onSeleccionar(aula, bloque)}
        onKeyDown={(e) => onKeyDown(e, filaIdx, colIdx)}
      />
    </td>
  );
}

/**
 * Vista de escritorio (≥ 1100 px): una fila por aula y dos columnas por hora,
 * con las franjas ocupadas unidas en una sola celda.
 */
export default function GrillaEscritorio({
  aulas,
  segmentosPorAula,
  reloj,
  cargando,
  onSeleccionarCelda,
  onKeyDown,
  contenedorRef
}) {
  return (
    <div className={styles.vistaEscritorio}>
      <div className={styles.scrollWrapper} ref={contenedorRef}>
        <table className={styles.tablaGrilla}>
          <colgroup>
            <col className={styles.colAula} />
            {BLOQUES.map((b) => (
              <col key={b.inicio} className={styles.colHora} />
            ))}
          </colgroup>

          <Cabecera reloj={reloj} />

          <tbody>
            {aulas.map((aula, filaIdx) => (
              <tr key={aula.id} className={styles.filaAula}>
                <CeldaAula aula={aula} />

                {segmentosPorAula[aula.id].map((seg) =>
                  seg.tipo === 'ocupada' ? (
                    <CeldaOcupada
                      key={`ocupada-${seg.colIdx}`}
                      segmento={seg}
                      aula={aula}
                      filaIdx={filaIdx}
                      reloj={reloj}
                    />
                  ) : (
                    <CeldaLibre
                      key={seg.bloque.inicio}
                      segmento={seg}
                      aula={aula}
                      filaIdx={filaIdx}
                      reloj={reloj}
                      cargando={cargando}
                      onSeleccionar={onSeleccionarCelda}
                      onKeyDown={onKeyDown}
                    />
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
