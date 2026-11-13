import { useMemo, useRef, useState } from 'react';
import {
  horaAMinutos,
  obtenerHoyArgentina,
  obtenerMinutosAhoraArgentina
} from '../config/horarios.js';
import { useNavegacionGrilla } from '../hooks/useNavegacionGrilla.js';
import { calcularSegmentosFila, calcularTramos, hayOcupacionEnRango } from './grillaCalculos.js';
import GrillaEscritorio from './GrillaEscritorio.jsx';
import GrillaCompacta from './GrillaCompacta.jsx';
import styles from './GrillaDisponibilidad.module.css';

function Leyenda({ esHoy, minutosAhora }) {
  const horaAhora = `${String(Math.floor(minutosAhora / 60)).padStart(2, '0')}:${String(
    minutosAhora % 60
  ).padStart(2, '0')}`;

  return (
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
          <span>Reserva pendiente</span>
        </span>
        <span className={styles.itemLeyenda}>
          <span className={styles.muestraAprobada} aria-hidden="true" />
          <span>Reserva aprobada</span>
        </span>
      </div>

      {esHoy ? (
        <span className={styles.indicadorAhora} data-testid="linea-ahora">
          Ahora ({horaAhora})
        </span>
      ) : null}
    </div>
  );
}

/**
 * Disponibilidad de todas las aulas en una fecha, en dos presentaciones según
 * el ancho de pantalla (ver `GrillaEscritorio` y `GrillaCompacta`).
 *
 * Seleccionar un rango en la vista de escritorio es un clic en la franja de
 * inicio y otro en la de fin: el primer clic queda como ancla, y el segundo
 * cierra el rango si no hay nada ocupado en el medio.
 */
export default function GrillaDisponibilidad({
  id,
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
  const reloj = { esHoy: Boolean(fecha && fecha === hoy), minutosAhora };

  const franjasDe = (aulaId) => disponibilidadPorAula[aulaId] || [];

  const aulaActiva =
    aulas.find((a) => String(a.id) === String(aulaIdSeleccionada)) || aulas[0] || null;

  const segmentosPorAula = useMemo(() => {
    const contextoBase = {
      hayFecha: Boolean(fecha),
      esHoy: reloj.esHoy,
      minutosAhora,
      inicioSelMin: horaAMinutos(horaInicioSeleccionada),
      finSelMin: horaAMinutos(horaFinSeleccionada)
    };

    return Object.fromEntries(
      aulas.map((aula) => [
        aula.id,
        calcularSegmentosFila(franjasDe(aula.id), {
          ...contextoBase,
          mismaAula: String(aulaIdSeleccionada) === String(aula.id)
        })
      ])
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aulas,
    disponibilidadPorAula,
    fecha,
    reloj.esHoy,
    minutosAhora,
    aulaIdSeleccionada,
    horaInicioSeleccionada,
    horaFinSeleccionada
  ]);

  const tramosAulaActiva =
    aulaActiva && fecha ? calcularTramos(franjasDe(aulaActiva.id), reloj) : null;

  const { manejarKeyDown } = useNavegacionGrilla({
    contenedorRef: grillaRef,
    totalFilas: aulas.length
  });

  /**
   * Primer clic: deja el ancla y preselecciona ese bloque.
   * Segundo clic sobre la misma aula y más adelante: cierra el rango.
   */
  const manejarClickCelda = (aula, bloque) => {
    const aulaId = String(aula.id);

    const cierraRango =
      ancla &&
      String(ancla.aulaId) === aulaId &&
      bloque.inicioMin >= ancla.inicioMin &&
      !hayOcupacionEnRango(franjasDe(aula.id), ancla.inicioMin, bloque.finMin);

    if (cierraRango) {
      onSeleccionarFranja?.({ aulaId, horaInicio: ancla.inicio, horaFin: bloque.fin });
      setAncla(null);
      return;
    }

    setAncla({ aulaId, inicio: bloque.inicio, inicioMin: bloque.inicioMin });
    onSeleccionarFranja?.({ aulaId, horaInicio: bloque.inicio, horaFin: bloque.fin });
  };

  return (
    <section id={id} aria-label="Grilla de disponibilidad horaria" className={styles.contenedor}>
      <Leyenda esHoy={reloj.esHoy} minutosAhora={minutosAhora} />

      {!fecha ? (
        <p className={styles.avisoSinFecha}>
          Elija una fecha para consultar las franjas libres y ocupadas de cada aula.
        </p>
      ) : null}

      <GrillaEscritorio
        aulas={aulas}
        segmentosPorAula={segmentosPorAula}
        reloj={reloj}
        cargando={cargando}
        onSeleccionarCelda={manejarClickCelda}
        onKeyDown={manejarKeyDown}
        contenedorRef={grillaRef}
      />

      <GrillaCompacta
        aulas={aulas}
        aulaActiva={aulaActiva}
        tramos={tramosAulaActiva}
        hayFecha={Boolean(fecha)}
        seleccion={{
          aulaId: aulaIdSeleccionada,
          horaInicio: horaInicioSeleccionada,
          horaFin: horaFinSeleccionada
        }}
        onElegirAula={(aula) =>
          onSeleccionarFranja?.({
            aulaId: String(aula.id),
            horaInicio: horaInicioSeleccionada || '',
            horaFin: horaFinSeleccionada || ''
          })
        }
        onElegirTramo={(tramo) =>
          onSeleccionarFranja?.({
            aulaId: String(aulaActiva.id),
            horaInicio: tramo.horaInicio,
            horaFin: tramo.horaFin
          })
        }
      />
    </section>
  );
}
