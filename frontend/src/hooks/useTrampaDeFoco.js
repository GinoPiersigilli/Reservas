import { useEffect } from 'react';

const SELECTOR_ENFOCABLES =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

const enfocables = (contenedor) =>
  contenedor ? Array.from(contenedor.querySelectorAll(SELECTOR_ENFOCABLES)) : [];

/** Lleva el foco al primer destino disponible al abrirse. */
const enfocarInicial = (contenedor, inicial) => {
  if (inicial && !inicial.disabled) {
    inicial.focus();
    return;
  }
  const candidatos = enfocables(contenedor);
  if (candidatos.length > 0) {
    candidatos[0].focus();
  } else {
    contenedor?.focus();
  }
};

/** Mantiene el ciclo de tabulación dentro del contenedor. */
const atraparTab = (evento, contenedor) => {
  const candidatos = enfocables(contenedor);
  if (candidatos.length === 0) {
    evento.preventDefault();
    return;
  }

  const primero = candidatos[0];
  const ultimo = candidatos[candidatos.length - 1];
  const activo = document.activeElement;
  const fueraDelDialogo = !contenedor.contains(activo);

  if (evento.shiftKey && (activo === primero || fueraDelDialogo)) {
    evento.preventDefault();
    ultimo.focus();
    return;
  }

  if (!evento.shiftKey && (activo === ultimo || fueraDelDialogo)) {
    evento.preventDefault();
    primero.focus();
  }
};

/**
 * Accesibilidad de una ventana modal: al abrirse lleva el foco adentro, impide
 * tabular fuera mientras está abierta, cierra con Escape y devuelve el foco al
 * elemento que la abrió.
 *
 * @param {object} opciones
 * @param {boolean} opciones.activo        Si la modal está abierta.
 * @param {object} opciones.contenedorRef  Ref al contenedor de la modal.
 * @param {object} [opciones.inicialRef]   Ref al elemento que recibe el foco al abrir.
 * @param {Function} [opciones.alEscapar]  Qué hacer con Escape.
 * @param {boolean} [opciones.bloqueado]   Si una operación en curso impide cerrar.
 */
export const useTrampaDeFoco = ({
  activo,
  contenedorRef,
  inicialRef,
  alEscapar,
  bloqueado = false
}) => {
  useEffect(() => {
    if (!activo) return undefined;

    const focoPrevio = document.activeElement;
    enfocarInicial(contenedorRef.current, inicialRef?.current);

    const manejarKeyDown = (evento) => {
      if (evento.key === 'Escape') {
        if (bloqueado) return;
        evento.preventDefault();
        evento.stopPropagation();
        alEscapar?.();
        return;
      }

      if (evento.key === 'Tab' && contenedorRef.current) {
        atraparTab(evento, contenedorRef.current);
      }
    };

    document.addEventListener('keydown', manejarKeyDown);

    return () => {
      document.removeEventListener('keydown', manejarKeyDown);
      if (typeof focoPrevio?.focus === 'function') focoPrevio.focus();
    };
  }, [activo, bloqueado, alEscapar, contenedorRef, inicialRef]);
};

export default useTrampaDeFoco;
