/**
 * Navegación con flechas por la grilla de disponibilidad.
 *
 * Las celdas son botones con `data-fila` y `data-col`, así que el movimiento se
 * resuelve sobre el DOM: las celdas ocupadas están deshabilitadas y hay que
 * saltearlas, y las flechas verticales buscan la columna más cercana en la
 * siguiente fila que tenga alguna franja seleccionable.
 */
const botonesDeFila = (contenedor, fila) =>
  Array.from(contenedor?.querySelectorAll(`button[data-fila="${fila}"]:not(:disabled)`) || []);

/** Mueve el foco a la columna contigua dentro de la misma fila. */
const moverHorizontal = (contenedor, fila, colIdx, direccion) => {
  const ordenados = botonesDeFila(contenedor, fila)
    .map((b) => ({ elemento: b, col: Number(b.dataset.col) }))
    .sort((a, b) => a.col - b.col);

  const actual = ordenados.findIndex((item) => item.col === colIdx);
  if (actual === -1) return false;

  const siguiente = ordenados[actual + direccion];
  if (!siguiente) return false;

  siguiente.elemento.focus();
  return true;
};

/**
 * Enfoca el botón de la columna más próxima a `colIdx`.
 * Devuelve false si la fila no tiene ninguna franja seleccionable.
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

/** Baja o sube de fila, salteando las que no tienen franjas seleccionables. */
const moverVertical = (contenedor, fila, colIdx, direccion, totalFilas) => {
  let destino = fila + direccion;

  while (destino >= 0 && destino < totalFilas) {
    if (enfocarColumnaMasCercana(botonesDeFila(contenedor, destino), colIdx)) return true;
    destino += direccion;
  }

  return false;
};

const HORIZONTALES = { ArrowRight: 1, ArrowLeft: -1 };
const VERTICALES = { ArrowDown: 1, ArrowUp: -1 };

export const useNavegacionGrilla = ({ contenedorRef, totalFilas }) => {
  const manejarKeyDown = (evento, filaIdx, colIdx) => {
    const horizontal = HORIZONTALES[evento.key];
    const vertical = VERTICALES[evento.key];
    if (!horizontal && !vertical) return;

    evento.preventDefault();

    if (horizontal) {
      moverHorizontal(contenedorRef.current, filaIdx, colIdx, horizontal);
      return;
    }

    moverVertical(contenedorRef.current, filaIdx, colIdx, vertical, totalFilas);
  };

  return { manejarKeyDown };
};

export default useNavegacionGrilla;
