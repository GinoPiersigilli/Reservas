import { useEffect, useState } from 'react';

/**
 * Hook para la gestión del modo oscuro en la aplicación.
 * - Sigue la preferencia del sistema (prefers-color-scheme) si no hay elección del usuario.
 * - Persiste la elección del usuario en localStorage ('tema': 'claro' | 'oscuro') con try/catch.
 * - Aplica el atributo data-theme en el <html> ('dark' | 'light').
 * - Sincroniza el estado entre múltiples instancias del hook.
 */

function obtenerPreferenciaSistema() {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }
  return 'claro';
}

function leerTemaGuardado() {
  try {
    const guardado = localStorage.getItem('tema');
    if (guardado === 'claro' || guardado === 'oscuro') {
      return guardado;
    }
  } catch {
    // localStorage no disponible o bloqueado
  }
  return null;
}

export function obtenerTemaInicial() {
  const guardado = leerTemaGuardado();
  if (guardado) return guardado;
  return obtenerPreferenciaSistema();
}

export function aplicarTemaEnDOM(tema) {
  if (typeof document === 'undefined') return;
  const modo = tema === 'oscuro' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', modo);
  document.documentElement.setAttribute('data-tema', tema);
}

function guardarTema(tema) {
  try {
    localStorage.setItem('tema', tema);
  } catch {
    // localStorage no disponible o bloqueado
  }
}

const subscriptores = new Set();
let temaActual = obtenerTemaInicial();

export function resetTema() {
  temaActual = obtenerTemaInicial();
  aplicarTemaEnDOM(temaActual);
}

function notificarSubscriptores(nuevoTema) {
  temaActual = nuevoTema;
  aplicarTemaEnDOM(nuevoTema);
  subscriptores.forEach((fn) => fn(nuevoTema));
}

export function useTema() {
  const [tema, setTemaState] = useState(() => {
    if (subscriptores.size === 0) {
      temaActual = obtenerTemaInicial();
    }
    return temaActual;
  });

  useEffect(() => {
    const callback = (nuevoTema) => {
      setTemaState(nuevoTema);
    };
    subscriptores.add(callback);
    return () => {
      subscriptores.delete(callback);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const manejarCambioSistema = (evento) => {
      // Solo actualiza según el sistema si el usuario no tiene una preferencia explícita guardada
      const guardado = leerTemaGuardado();
      if (!guardado) {
        const nuevoTema = evento.matches ? 'oscuro' : 'claro';
        notificarSubscriptores(nuevoTema);
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', manejarCambioSistema);
      return () => mediaQuery.removeEventListener('change', manejarCambioSistema);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(manejarCambioSistema);
      return () => mediaQuery.removeListener(manejarCambioSistema);
    }
    return undefined;
  }, []);

  const setTema = (nuevoTema) => {
    if (nuevoTema !== 'claro' && nuevoTema !== 'oscuro') return;
    guardarTema(nuevoTema);
    notificarSubscriptores(nuevoTema);
  };

  const toggleTema = () => {
    const siguiente = tema === 'oscuro' ? 'claro' : 'oscuro';
    setTema(siguiente);
  };

  const esOscuro = tema === 'oscuro';

  return {
    tema,
    esOscuro,
    setTema,
    toggleTema
  };
}

export default useTema;
