import {
  MINUTOS_FIN_JORNADA,
  MINUTOS_INICIO_JORNADA,
  generarBloquesJornada,
  horaAMinutos,
  minutosAHora
} from '../config/horarios.js';
import { TEXTOS } from '../textos.js';

/**
 * Cálculos de la grilla de disponibilidad, sin React: decidir qué franjas están
 * ocupadas, libres o seleccionadas es la parte que conviene poder probar sola.
 */

export const BLOQUES = generarBloquesJornada();

const seSolapan = (franja, inicioMin, finMin) => {
  const fIni = horaAMinutos(franja.horaInicio);
  const fFin = horaAMinutos(franja.horaFin);
  return fIni < finMin && fFin > inicioMin;
};

/** Franja ocupada que cubre el bloque, si existe. */
export const ocupacionDelBloque = (franjas, bloque) =>
  franjas.find((f) => seSolapan(f, bloque.inicioMin, bloque.finMin));

/** Si el rango pedido choca con alguna franja ocupada. */
export const hayOcupacionEnRango = (franjas, inicioMin, finMin) =>
  franjas.some((f) => seSolapan(f, inicioMin, finMin));

/** Dos bloques consecutivos pertenecen a la misma reserva. */
const esMismaOcupacion = (o1, o2) => {
  if (!o1 || !o2) return false;
  if (o1.id && o2.id) return o1.id === o2.id;
  return o1.horaInicio === o2.horaInicio && o1.horaFin === o2.horaFin;
};

/** Hasta dónde se extiende la misma reserva, para unir celdas con colSpan. */
const finDelTramoOcupado = (franjas, desde, ocupacion) => {
  let fin = desde + 1;
  while (
    fin < BLOQUES.length &&
    esMismaOcupacion(ocupacionDelBloque(franjas, BLOQUES[fin]), ocupacion)
  ) {
    fin++;
  }
  return fin;
};

const segmentoLibre = (bloque, colIdx, contexto) => {
  const { esHoy, minutosAhora, mismaAula, inicioSelMin, finSelMin } = contexto;

  const estaSeleccionada = Boolean(
    mismaAula &&
      !Number.isNaN(inicioSelMin) &&
      !Number.isNaN(finSelMin) &&
      bloque.inicioMin >= inicioSelMin &&
      bloque.finMin <= finSelMin
  );

  return {
    tipo: 'libre',
    colIdx,
    span: 1,
    bloque,
    esPasado: Boolean(esHoy && bloque.finMin <= minutosAhora),
    estaSeleccionada
  };
};

/**
 * Segmentos de una fila de la grilla: las franjas ocupadas se unen en un solo
 * segmento con su `span`, y el resto queda como bloques libres de media hora.
 *
 * @param {object[]} franjas Franjas ocupadas del aula en esa fecha.
 * @param {object} contexto  { hayFecha, esHoy, minutosAhora, mismaAula, inicioSelMin, finSelMin }
 */
export const calcularSegmentosFila = (franjas, contexto) => {
  const segmentos = [];
  let i = 0;

  while (i < BLOQUES.length) {
    const bloque = BLOQUES[i];
    const ocupacion = contexto.hayFecha ? ocupacionDelBloque(franjas, bloque) : null;

    if (!ocupacion) {
      segmentos.push(segmentoLibre(bloque, i, contexto));
      i += 1;
      continue;
    }

    const fin = finDelTramoOcupado(franjas, i, ocupacion);
    segmentos.push({
      tipo: 'ocupada',
      colIdx: i,
      span: fin - i,
      ocupacion,
      bloqueInicio: BLOQUES[i],
      bloqueFin: BLOQUES[fin - 1]
    });
    i = fin;
  }

  return segmentos;
};

/** Franjas ocupadas ordenadas y con los textos que muestra la vista compacta. */
const ocupadasConTexto = (franjas) =>
  franjas
    .map((f) => ({
      ...f,
      inicioMin: horaAMinutos(f.horaInicio),
      finMin: horaAMinutos(f.horaFin),
      rangoTexto: `${f.horaInicio.slice(0, 5)}–${f.horaFin.slice(0, 5)}`,
      nombreEstado: f.estado === 'pendiente' ? TEXTOS.estados.pendiente : TEXTOS.estados.aprobada
    }))
    .filter((f) => !Number.isNaN(f.inicioMin) && !Number.isNaN(f.finMin))
    .sort((a, b) => a.inicioMin - b.inicioMin);

const tramoLibre = (inicioMin, finMin) => ({
  horaInicio: minutosAHora(inicioMin),
  horaFin: minutosAHora(finMin),
  inicioMin,
  finMin
});

/**
 * Para la vista compacta: las franjas ocupadas y los huecos libres agrupados.
 *
 * En el día de hoy los tramos arrancan en la próxima media hora, para no
 * ofrecer horarios que ya pasaron.
 */
export const calcularTramos = (franjas, { esHoy, minutosAhora }) => {
  const ocupadas = ocupadasConTexto(franjas);

  const inicioJornada = esHoy
    ? Math.max(MINUTOS_INICIO_JORNADA, Math.ceil(minutosAhora / 30) * 30)
    : MINUTOS_INICIO_JORNADA;

  const libres = [];
  let puntero = inicioJornada;

  for (const ocupada of ocupadas) {
    if (ocupada.finMin <= puntero) continue;

    if (ocupada.inicioMin > puntero) {
      libres.push(tramoLibre(puntero, Math.min(ocupada.inicioMin, MINUTOS_FIN_JORNADA)));
    }
    puntero = Math.max(puntero, ocupada.finMin);
    if (puntero >= MINUTOS_FIN_JORNADA) break;
  }

  if (puntero < MINUTOS_FIN_JORNADA) {
    libres.push(tramoLibre(puntero, MINUTOS_FIN_JORNADA));
  }

  return { ocupadas, libres };
};
