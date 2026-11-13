import { useCallback, useState } from 'react';

const CLAVE = 'vistaReservas';
export const VISTAS = ['agenda', 'tabla'];

const leerPreferencia = () => {
  try {
    const guardada = window.localStorage.getItem(CLAVE);
    return VISTAS.includes(guardada) ? guardada : 'agenda';
  } catch {
    // Modo privado o almacenamiento bloqueado: la agenda es el valor por defecto.
    return 'agenda';
  }
};

/**
 * Agenda o tabla. La preferencia vive en el navegador de quien la eligió; si no
 * se puede guardar, la elección vale para la sesión igual.
 */
export const useVistaReservas = () => {
  const [vista, setVista] = useState(leerPreferencia);

  const elegirVista = useCallback((nueva) => {
    if (!VISTAS.includes(nueva)) return;
    setVista(nueva);
    try {
      window.localStorage.setItem(CLAVE, nueva);
    } catch {
      // Sin persistencia, pero la vista cambia igual.
    }
  }, []);

  return { vista, elegirVista };
};

export default useVistaReservas;
