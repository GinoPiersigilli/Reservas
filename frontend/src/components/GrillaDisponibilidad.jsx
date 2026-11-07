import { useMemo, useRef, useState } from 'react';
import {
  generarBloquesJornada,
  generarCabecerasHoras,
  horaAMinutos,
  obtenerHoyArgentina,
  obtenerMinutosAhoraArgentina
} from '../config/horarios.js';
import { TEXTOS } from '../textos.js';
import styles from './GrillaDisponibilidad.module.css';

const BLOQUES = generarBloquesJornada();
const CABECERAS_HORAS = generarCabecerasHoras();

export default function GrillaDisponibilidad({
  aulas = [],
  fecha = '',
  disponibilidadPorAula = {},
  cargando = false,
  aulaIdSeleccionada = '',
  horaInicioSeleccionada = '',
  horaFinSeleccionada = '',
  onSeleccionarFranja
}) {
  const [ancla, setAncla] = useState(null);
  const grillaRef = useRef(null);

  const hoy = useMemo(() => obtenerHoyArgentina(), []);
  const minutosAhora = useMemo(() => obtenerMinutosAhoraArgentina(), []);
  const esHoy = Boolean(fecha && fecha === hoy);

  const inicioSelMin = horaAMinutos(horaInicioSeleccionada);
  const finSelMin = horaAMinutos(horaFinSeleccionada);

  const obtenerOcupacionBloque = (aulaId, bloque) => {
    const franjas = disponibilidadPorAula[aulaId] || [];
    return franjas.find((f) => {
      const fIni = horaAMinutos(f.horaInicio);
      const fFin = horaAMinutos(f.horaFin);
      return fIni < bloque.finMin && fFin > bloque.inicioMin;
    });
  };

  const hayOcupacionEnRango = (aulaId, minInicio, minFin) => {
    const franjas = disponibilidadPorAula[aulaId] || [];
    return franjas.some((f) => {
      const fIni = horaAMinutos(f.horaInicio);
      const fFin = horaAMinutos(f.horaFin);
      return fIni < minFin && fFin > minInicio;
    });
  };

  const manejarClickCelda = (aula, bloque) => {
    const idAulaStr = String(aula.id);

    if (
      ancla &&
      String(ancla.aulaId) === idAulaStr &&
      bloque.inicioMin >= ancla.inicioMin &&
      !hayOcupacionEnRango(aula.id, ancla.inicioMin, bloque.finMin)
    ) {
      onSeleccionarFranja?.({
        aulaId: idAulaStr,
        horaInicio: ancla.inicio,
        horaFin: bloque.fin
      });
      setAncla(null);
      return;
    }

    setAncla({
      aulaId: idAulaStr,
      inicio: bloque.inicio,
      inicioMin: bloque.inicioMin
    });

    onSeleccionarFranja?.({
      aulaId: idAulaStr,
      horaInicio: bloque.inicio,
      horaFin: bloque.fin
    });
  };

  const manejarKeyDown = (evento, filaIdx, colIdx) => {
    const teclas = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
    if (!teclas.includes(evento.key)) return;

    evento.preventDefault();
    const deltaFila = evento.key === 'ArrowDown' ? 1 : evento.key === 'ArrowUp' ? -1 : 0;
    const deltaCol = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;

    let f = filaIdx + deltaFila;
    let c = colIdx + deltaCol;

    while (f >= 0 && f < aulas.length && c >= 0 && c < BLOQUES.length) {
      const selector = `[data-celda="${f}-${c}"]:not(:disabled)`;
      const destino = grillaRef.current?.querySelector(selector);
      if (destino) {
        destino.focus();
        return;
      }
      if (deltaCol !== 0) {
        c += deltaCol;
      } else {
        f += deltaFila;
      }
    }
  };

  return (
    <section
      aria-label="Grilla de disponibilidad horaria"
      className={styles.contenedor}
    >
      <div className={styles.cabecera}>
        <div className={styles.leyenda}>
          <span className={styles.itemLeyenda}>
            <span className={styles.muestraLibre} aria-hidden="true" />
            <span>Libre</span>
          </span>
          <span className={styles.itemLeyenda}>
            <span className={styles.muestraSeleccionado} aria-hidden="true" />
            <span>Seleccionado</span>
          </span>
          <span className={styles.itemLeyenda}>
            <span className={styles.muestraPendiente} aria-hidden="true" />
            <span>{TEXTOS.estados.pendiente} (rayado)</span>
          </span>
          <span className={styles.itemLeyenda}>
            <span className={styles.muestraAprobada} aria-hidden="true" />
            <span>{TEXTOS.estados.aprobada} (macizo)</span>
          </span>
        </div>

        {esHoy ? (
          <span className={styles.indicadorAhora} data-testid="linea-ahora">
            Ahora ({ String(Math.floor(minutosAhora / 60)).padStart(2, '0') }:
            { String(minutosAhora % 60).padStart(2, '0') })
          </span>
        ) : null}
      </div>

      {!fecha ? (
        <p className={styles.avisoSinFecha}>
          Elija una fecha para consultar las franjas libres y ocupadas de cada aula.
        </p>
      ) : null}

      <div className={styles.scrollWrapper} ref={grillaRef}>
        <table className={styles.tablaGrilla}>
          <thead className={styles.theadEscritorio}>
            <tr>
              <th scope="col" className={styles.thAula}>
                Aula
              </th>
              {CABECERAS_HORAS.map((h) => {
                const minHora = horaAMinutos(h.hora);
                const esHoraActual =
                  esHoy && minutosAhora >= minHora && minutosAhora < minHora + 60;
                return (
                  <th
                    key={h.hora}
                    scope="col"
                    colSpan={2}
                    className={[
                      styles.thHora,
                      esHoraActual ? styles.thHoraAhora : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {h.etiqueta}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {aulas.map((aula, filaIdx) => (
              <tr key={aula.id} className={styles.filaAula}>
                <td className={styles.tdAula}>
                  <span className={styles.nombreAula}>{aula.nombre}</span>
                  <span className={styles.metaAula}>
                    Cap. {aula.capacidad}
                    {aula.ubicacion ? ` · ${aula.ubicacion}` : ''}
                  </span>
                </td>

                {BLOQUES.map((bloque, colIdx) => {
                  const ocupacion = fecha
                    ? obtenerOcupacionBloque(aula.id, bloque)
                    : null;
                  const esPasado = Boolean(esHoy && bloque.finMin <= minutosAhora);
                  const esBloqueAhora = Boolean(
                    esHoy &&
                      minutosAhora >= bloque.inicioMin &&
                      minutosAhora < bloque.finMin
                  );

                  const estaSeleccionada = Boolean(
                    String(aulaIdSeleccionada) === String(aula.id) &&
                      !Number.isNaN(inicioSelMin) &&
                      !Number.isNaN(finSelMin) &&
                      bloque.inicioMin >= inicioSelMin &&
                      bloque.finMin <= finSelMin &&
                      !ocupacion
                  );

                  const deshabilitada = Boolean(cargando || ocupacion || esPasado);

                  let claseEstado = styles.celdaLibre;
                  let textoEstado = 'libre';
                  let etiquetaVisible = '·';

                  if (ocupacion) {
                    const esPendiente = ocupacion.estado === 'pendiente';
                    claseEstado = esPendiente
                      ? styles.celdaPendiente
                      : styles.celdaAprobada;
                    const nombreEstado = esPendiente
                      ? TEXTOS.estados.pendiente
                      : TEXTOS.estados.aprobada;
                    const rango = `${ocupacion.horaInicio.slice(0, 5)}–${ocupacion.horaFin.slice(0, 5)}`;
                    textoEstado = `ocupada (${nombreEstado} ${rango})`;
                    etiquetaVisible = rango;
                  } else if (esPasado) {
                    claseEstado = styles.celdaPasada;
                    textoEstado = 'horario pasado';
                  } else if (estaSeleccionada) {
                    claseEstado = styles.celdaSeleccionada;
                    textoEstado = 'seleccionado';
                    etiquetaVisible = `${bloque.inicio}`;
                  }

                  const ariaLabel = `${aula.nombre}, ${bloque.inicio} a ${bloque.fin}, ${textoEstado}`;

                  return (
                    <td
                      key={bloque.inicio}
                      className={[
                        styles.tdCelda,
                        esBloqueAhora ? styles.tdCeldaAhora : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <button
                        type="button"
                        data-celda={`${filaIdx}-${colIdx}`}
                        disabled={deshabilitada}
                        aria-label={ariaLabel}
                        aria-pressed={estaSeleccionada}
                        className={[styles.celdaBoton, claseEstado]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => manejarClickCelda(aula, bloque)}
                        onKeyDown={(e) => manejarKeyDown(e, filaIdx, colIdx)}
                      >
                        <span className={styles.etiquetaHoraMovil}>
                          {bloque.inicio}–{bloque.fin}{' '}
                        </span>
                        <span className={styles.etiquetaRangoOcupado}>
                          {etiquetaVisible}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

