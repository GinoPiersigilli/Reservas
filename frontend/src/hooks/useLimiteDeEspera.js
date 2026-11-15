import { useEffect, useState } from 'react';

/** Diez segundos: más que cualquier arranque normal de Clerk, menos que la
 * paciencia de quien mira una pantalla que no cambia. */
export const LIMITE_DE_ESPERA_MS = 10000;

/**
 * Avisa cuando una espera se pasó de tiempo.
 *
 * Existe porque un indicador de carga sin límite es una pantalla sin salida: si
 * aquello que se espera nunca llega —el servicio no responde, se cortó la
 * conexión—, la persona se queda mirando «Cargando…» sin nada que tocar.
 *
 * El hook no recibe si la espera sigue abierta: la espera es el componente que
 * lo usa. Mientras ese componente esté montado se está esperando, y cuando lo
 * esperado llega, quien lo monta deja de hacerlo y el contador se va con él. Así
 * no hay un estado que reiniciar ni dos fuentes de verdad sobre lo mismo.
 *
 * @param {number} [limiteMs] Cuánto esperar antes de dar la espera por vencida.
 * @returns {boolean} true cuando se agotó el tiempo.
 */
export const useLimiteDeEspera = (limiteMs = LIMITE_DE_ESPERA_MS) => {
  const [vencido, setVencido] = useState(false);

  useEffect(() => {
    const temporizador = setTimeout(() => setVencido(true), limiteMs);
    return () => clearTimeout(temporizador);
  }, [limiteMs]);

  return vencido;
};

export default useLimiteDeEspera;
