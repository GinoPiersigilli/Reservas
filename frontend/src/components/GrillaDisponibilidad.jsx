import { useMemo, useRef, useState } from 'react';
import {
  MINUTOS_FIN_JORNADA,
  MINUTOS_INICIO_JORNADA,
  generarBloquesJornada,
  generarCabecerasHoras,
  horaAMinutos,
  minutosAHora,
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

  const aulaActiva =
    aulas.find((a) => String(a.id) === String(aulaIdSeleccionada)) ||
    (aulas.length > 0 ? aulas[0] : null);

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

  const esMismaOcupacion = (o1, o2) => {
    if (!o1 || !o2) return false;
    if (o1.id && o2.id) return o1.id === o2.id;
    return o1.horaInicio === o2.horaInicio && o1.horaFin === o2.horaFin;
  };

  const calcularSegmentosFila = (aulaId) => {
    const segmentos = [];
    let i = 0;

    while (i < BLOQUES.length) {
      const bloque = BLOQUES[i];
      const ocupacion = fecha ? obtenerOcupacionBloque(aulaId, bloque) : null;

      if (ocupacion) {
        const colIdxInicio = i;
        let colIdxFin = i + 1;
        while (
          colIdxFin < BLOQUES.length &&
          esMismaOcupacion(obtenerOcupacionBloque(aulaId, BLOQUES[colIdxFin]), ocupacion)
        ) {
          colIdxFin++;
        }

        const span = colIdxFin - colIdxInicio;
        segmentos.push({
          tipo: 'ocupada',
          colIdx: colIdxInicio,
          span,
          ocupacion,
          bloqueInicio: BLOQUES[colIdxInicio],
          bloqueFin: BLOQUES[colIdxFin - 1]
        });

        i = colIdxFin;
      } else {
        const esPasado = Boolean(esHoy && bloque.finMin <= minutosAhora);
        const estaSeleccionada = Boolean(
          String(aulaIdSeleccionada) === String(aulaId) &&
            !Number.isNaN(inicioSelMin) &&
            !Number.isNaN(finSelMin) &&
            bloque.inicioMin >= inicioSelMin &&
            bloque.finMin <= finSelMin
        );

        segmentos.push({
          tipo: 'libre',
          colIdx: i,
          span: 1,
          bloque,
          esPasado,
          estaSeleccionada
        });

        i++;
      }
    }

    return segmentos;
  };

  const calcularTramosCompactos = (aulaId) => {
    const franjas = disponibilidadPorAula[aulaId] || [];
    const ocupadas = franjas
      .map((f) => ({
        ...f,
        inicioMin: horaAMinutos(f.horaInicio),
        finMin: horaAMinutos(f.horaFin),
        rangoTexto: `${f.horaInicio.slice(0, 5)}–${f.horaFin.slice(0, 5)}`,
        nombreEstado: f.estado === 'pendiente' ? TEXTOS.estados.pendiente : TEXTOS.estados.aprobada
      }))
      .filter((f) => !Number.isNaN(f.inicioMin) && !Number.isNaN(f.finMin))
      .sort((a, b) => a.inicioMin - b.inicioMin);

    const minInicioJornada = esHoy
      ? Math.max(MINUTOS_INICIO_JORNADA, Math.ceil(minutosAhora / 30) * 30)
      : MINUTOS_INICIO_JORNADA;

    const libres = [];
    let punteroMin = minInicioJornada;

    for (const oc of ocupadas) {
      if (oc.finMin <= punteroMin) continue;

      if (oc.inicioMin > punteroMin) {
        libres.push({
          horaInicio: minutosAHora(punteroMin),
          horaFin: minutosAHora(Math.min(oc.inicioMin, MINUTOS_FIN_JORNADA)),
          inicioMin: punteroMin,
          finMin: Math.min(oc.inicioMin, MINUTOS_FIN_JORNADA)
        });
      }
      punteroMin = Math.max(punteroMin, oc.finMin);
      if (punteroMin >= MINUTOS_FIN_JORNADA) break;
    }

    if (punteroMin < MINUTOS_FIN_JORNADA) {
      libres.push({
        horaInicio: minutosAHora(punteroMin),
        horaFin: minutosAHora(MINUTOS_FIN_JORNADA),
        inicioMin: punteroMin,
        finMin: MINUTOS_FIN_JORNADA
      });
    }

    return { ocupadas, libres };
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

  /**
   * Mueve el foco al botón de la columna más próxima a `colIdx`.
   * Devuelve false cuando la fila no tiene ninguna franja seleccionable.
   */
  const enfocarColumnaMasCercana = (botones, colIdx) => {
    if (botones.length === 0) return false;

    const masCercano = botones.reduce((mejor, candidato) => {
      const distanciaMejor = Math.abs(Number(mejor.dataset.col) - colIdx);
      const distanciaCandidato = Math.abs(Number(candidato.dataset.col) - colIdx);
      return distanciaCandidato < distanciaMejor ? candidato : mejor;
    });

    masCercano.focus();
    return true;
  };

  const manejarKeyDown = (evento, filaIdx, colIdx) => {
    const teclas = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
    if (!teclas.includes(evento.key)) return;

    evento.preventDefault();

    if (evento.key === 'ArrowRight' || evento.key === 'ArrowLeft') {
      const direccion = evento.key === 'ArrowRight' ? 1 : -1;
      const botonesFila = Array.from(
        grillaRef.current?.querySelectorAll(`button[data-fila="${filaIdx}"]:not(:disabled)`) || []
      );
      const ordenados = botonesFila
        .map((b) => ({ elemento: b, col: Number(b.dataset.col) }))
        .sort((a, b) => a.col - b.col);

      const actualIdx = ordenados.findIndex((item) => item.col === colIdx);
      if (actualIdx !== -1) {
        const siguiente = ordenados[actualIdx + direccion];
        if (siguiente) {
          siguiente.elemento.focus();
          return;
        }
      }
    }

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      const direccionFila = evento.key === 'ArrowDown' ? 1 : -1;
      let targetFila = filaIdx + direccionFila;

      // Se salta hacia la primera fila que tenga alguna franja seleccionable.
      while (targetFila >= 0 && targetFila < aulas.length) {
        const botonesTarget = Array.from(
          grillaRef.current?.querySelectorAll(`button[data-fila="${targetFila}"]:not(:disabled)`) ||
            []
        );
        if (enfocarColumnaMasCercana(botonesTarget, colIdx)) return;
        targetFila += direccionFila;
      }
    }
  };

  const tramosAulaActiva = aulaActiva && fecha ? calcularTramosCompactos(aulaActiva.id) : null;

  return (
    <section aria-label="Grilla de disponibilidad horaria" className={styles.contenedor}>
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
            Ahora ({String(Math.floor(minutosAhora / 60)).padStart(2, '0')}:
            {String(minutosAhora % 60).padStart(2, '0')})
          </span>
        ) : null}
      </div>

      {!fecha ? (
        <p className={styles.avisoSinFecha}>
          Elija una fecha para consultar las franjas libres y ocupadas de cada aula.
        </p>
      ) : null}

      {/* Vista Escritorio: Tabla de 28 columnas (>= 1100 px) */}
      <div className={styles.vistaEscritorio}>
        <div className={styles.scrollWrapper} ref={grillaRef}>
          <table className={styles.tablaGrilla}>
            <colgroup>
              <col className={styles.colAula} />
              {BLOQUES.map((b) => (
                <col key={b.inicio} className={styles.colHora} />
              ))}
            </colgroup>
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
                      className={[styles.thHora, esHoraActual ? styles.thHoraAhora : '']
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {h.hora}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {aulas.map((aula, filaIdx) => {
                const segmentos = calcularSegmentosFila(aula.id);

                return (
                  <tr key={aula.id} className={styles.filaAula}>
                    <td
                      className={styles.tdAula}
                      title={`${aula.nombre}${aula.ubicacion ? ` · ${aula.ubicacion}` : ''} (Cap. ${aula.capacidad})`}
                    >
                      <span className={styles.nombreAula} title={aula.nombre}>
                        {aula.nombre}
                      </span>
                      <span className={styles.metaAula}>
                        Cap. {aula.capacidad}
                        {aula.ubicacion ? ` · ${aula.ubicacion}` : ''}
                      </span>
                    </td>

                    {segmentos.map((seg) => {
                      if (seg.tipo === 'ocupada') {
                        const esPendiente = seg.ocupacion.estado === 'pendiente';
                        const nombreEstado = esPendiente
                          ? TEXTOS.estados.pendiente
                          : TEXTOS.estados.aprobada;
                        const rangoInicio = seg.ocupacion.horaInicio.slice(0, 5);
                        const rangoFin = seg.ocupacion.horaFin.slice(0, 5);
                        const rangoTexto = `${rangoInicio}–${rangoFin}`;
                        const ariaLabel = `${aula.nombre}, ${rangoInicio} a ${rangoFin}, ocupada (${nombreEstado})`;

                        const esBloqueAhora = Boolean(
                          esHoy &&
                            minutosAhora >= horaAMinutos(rangoInicio) &&
                            minutosAhora < horaAMinutos(rangoFin)
                        );

                        return (
                          <td
                            key={`ocupada-${seg.colIdx}`}
                            colSpan={seg.span}
                            className={[
                              styles.tdCelda,
                              styles.tdOcupada,
                              seg.colIdx % 2 === 0 ? styles.tdBordeHora : styles.tdBordeMedia,
                              esBloqueAhora ? styles.tdCeldaAhora : ''
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <button
                              type="button"
                              disabled
                              data-fila={filaIdx}
                              data-col={seg.colIdx}
                              aria-label={ariaLabel}
                              className={[
                                styles.bloqueOcupado,
                                esPendiente ? styles.bloquePendiente : styles.bloqueAprobado
                              ].join(' ')}
                            >
                              <span className={styles.textoRangoOcupado}>{rangoTexto}</span>
                            </button>
                          </td>
                        );
                      }

                      const esBloqueAhora = Boolean(
                        esHoy &&
                          minutosAhora >= seg.bloque.inicioMin &&
                          minutosAhora < seg.bloque.finMin
                      );

                      let claseEstado = styles.celdaLibre;
                      let textoEstado = 'libre';

                      if (seg.esPasado) {
                        claseEstado = styles.celdaPasada;
                        textoEstado = 'horario pasado';
                      } else if (seg.estaSeleccionada) {
                        claseEstado = styles.celdaSeleccionada;
                        textoEstado = 'seleccionado';
                      }

                      const ariaLabel = `${aula.nombre}, ${seg.bloque.inicio} a ${seg.bloque.fin}, ${textoEstado}`;

                      return (
                        <td
                          key={seg.bloque.inicio}
                          className={[
                            styles.tdCelda,
                            styles.tdLibre,
                            seg.colIdx % 2 === 0 ? styles.tdBordeHora : styles.tdBordeMedia,
                            esBloqueAhora ? styles.tdCeldaAhora : ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <button
                            type="button"
                            data-fila={filaIdx}
                            data-col={seg.colIdx}
                            data-celda={`${filaIdx}-${seg.colIdx}`}
                            disabled={Boolean(cargando || seg.esPasado)}
                            aria-label={ariaLabel}
                            aria-pressed={seg.estaSeleccionada}
                            className={[styles.celdaBoton, claseEstado].filter(Boolean).join(' ')}
                            onClick={() => manejarClickCelda(aula, seg.bloque)}
                            onKeyDown={(e) => manejarKeyDown(e, filaIdx, seg.colIdx)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista Compacta: Tablet y móvil (< 1100 px) */}
      <div className={styles.vistaCompacta}>
        {fecha ? (
          <>
            {aulas.length > 1 ? (
              <div
                className={styles.tabsAulasCompactas}
                role="tablist"
                aria-label="Aulas disponibles"
              >
                {aulas.map((a) => {
                  const esActiva = String(a.id) === String(aulaActiva?.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="tab"
                      aria-selected={esActiva}
                      className={[
                        styles.tabAulaCompacta,
                        esActiva ? styles.tabAulaCompactaActiva : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() =>
                        onSeleccionarFranja?.({
                          aulaId: String(a.id),
                          horaInicio: horaInicioSeleccionada || '',
                          horaFin: horaFinSeleccionada || ''
                        })
                      }
                    >
                      {a.nombre}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {aulaActiva && tramosAulaActiva ? (
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
                  {tramosAulaActiva.ocupadas.length > 0 ? (
                    <ul className={styles.listaOcupadasCompacta}>
                      {tramosAulaActiva.ocupadas.map((oc, idx) => (
                        <li
                          key={`${oc.rangoTexto}-${idx}`}
                          className={[
                            styles.itemOcupadaCompacta,
                            oc.estado === 'pendiente'
                              ? styles.itemOcupadaPendiente
                              : styles.itemOcupadaAprobada
                          ].join(' ')}
                        >
                          <span
                            className={[
                              styles.muestraMuesca,
                              oc.estado === 'pendiente'
                                ? styles.muestraPendiente
                                : styles.muestraAprobada
                            ].join(' ')}
                            aria-hidden="true"
                          />
                          <span>
                            Ocupada {oc.rangoTexto}, {oc.nombreEstado.toLowerCase()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.textoVacioCompacto}>
                      Sin reservas en esta fecha (aula libre durante toda la jornada).
                    </p>
                  )}
                </div>

                <div className={styles.seccionLibresCompacta}>
                  <h4 className={styles.subtituloCompacto}>
                    Tramos libres agrupados (toque para prellenar horario)
                  </h4>
                  {tramosAulaActiva.libres.length > 0 ? (
                    <ul className={styles.listaLibresCompacta}>
                      {tramosAulaActiva.libres.map((tramo) => {
                        const esTramoSeleccionado = Boolean(
                          String(aulaIdSeleccionada) === String(aulaActiva.id) &&
                            horaInicioSeleccionada === tramo.horaInicio &&
                            horaFinSeleccionada === tramo.horaFin
                        );

                        return (
                          <li key={`${tramo.horaInicio}-${tramo.horaFin}`}>
                            <button
                              type="button"
                              className={[
                                styles.botonTramoLibre,
                                esTramoSeleccionado ? styles.botonTramoSeleccionado : ''
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onClick={() =>
                                onSeleccionarFranja?.({
                                  aulaId: String(aulaActiva.id),
                                  horaInicio: tramo.horaInicio,
                                  horaFin: tramo.horaFin
                                })
                              }
                              aria-label={`${aulaActiva.nombre}, libre de ${tramo.horaInicio} a ${tramo.horaFin}`}
                              aria-pressed={esTramoSeleccionado}
                            >
                              <span className={styles.etiquetaTramoLibre}>
                                Libre {tramo.horaInicio}–{tramo.horaFin}
                              </span>
                              <span className={styles.accionTramoLibre}>
                                {esTramoSeleccionado ? 'Seleccionado' : 'Elegir tramo'}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className={styles.textoVacioCompacto}>
                      No hay tramos libres disponibles para esta fecha.
                    </p>
                  )}
                </div>
              </article>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
