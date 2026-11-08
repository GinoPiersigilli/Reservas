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
          esMismaOcupacion(
            obtenerOcupacionBloque(aulaId, BLOQUES[colIdxFin]),
            ocupacion
          )
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

    if (evento.key === 'ArrowRight' || evento.key === 'ArrowLeft') {
      const direccion = evento.key === 'ArrowRight' ? 1 : -1;
      const botonesFila = Array.from(
        grillaRef.current?.querySelectorAll(
          `button[data-fila="${filaIdx}"]:not(:disabled)`
        ) || []
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

      while (targetFila >= 0 && targetFila < aulas.length) {
        const botonesTarget = Array.from(
          grillaRef.current?.querySelectorAll(
            `button[data-fila="${targetFila}"]:not(:disabled)`
          ) || []
        );
        if (botonesTarget.length > 0) {
          let masCercano = botonesTarget[0];
          let menorDistancia = Math.abs(Number(masCercano.dataset.col) - colIdx);
          for (let i = 1; i < botonesTarget.length; i++) {
            const dist = Math.abs(Number(botonesTarget[i].dataset.col) - colIdx);
            if (dist < menorDistancia) {
              menorDistancia = dist;
              masCercano = botonesTarget[i];
            }
          }
          masCercano.focus();
          return;
        }
        targetFila += direccionFila;
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
                    className={[
                      styles.thHora,
                      esHoraActual ? styles.thHoraAhora : ''
                    ]
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
                  <td className={styles.tdAula}>
                    <span className={styles.nombreAula}>{aula.nombre}</span>
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
                            seg.colIdx % 2 === 0
                              ? styles.tdBordeHora
                              : styles.tdBordeMedia,
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
                              esPendiente
                                ? styles.bloquePendiente
                                : styles.bloqueAprobado
                            ].join(' ')}
                          >
                            <span className={styles.etiquetaHoraMovil}>
                              {rangoTexto} ({nombreEstado})
                            </span>
                            <span className={styles.textoRangoOcupado}>
                              {rangoTexto}
                            </span>
                          </button>
                        </td>
                      );
                    }

                    // Franja libre o pasada
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
                          seg.colIdx % 2 === 0
                            ? styles.tdBordeHora
                            : styles.tdBordeMedia,
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
                          className={[styles.celdaBoton, claseEstado]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => manejarClickCelda(aula, seg.bloque)}
                          onKeyDown={(e) =>
                            manejarKeyDown(e, filaIdx, seg.colIdx)
                          }
                        >
                          <span className={styles.etiquetaHoraMovil}>
                            {seg.bloque.inicio}–{seg.bloque.fin} (Libre)
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
