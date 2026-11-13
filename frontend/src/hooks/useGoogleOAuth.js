import { useState, useEffect, useRef } from 'react';
import { TEXTOS } from '../textos.js';

/**
 * Hook para gestionar el flujo OAuth con Google mediante Clerk,
 * protegiendo el estado contra restauraciones de bfcache y pestañas en segundo plano.
 *
 * @param {Object} params
 * @param {Object} params.authResource Instancia de signIn (Login) o signUp (Register)
 * @param {boolean} params.isLoaded Indica si el SDK de Clerk terminó de cargar
 * @param {string} [params.defaultErrorMessage] Mensaje de respaldo ante fallos de redirección
 * @param {number} [params.timeoutMs=20000] Tiempo máximo de espera antes de restaurar el botón
 */
export function useGoogleOAuth({
  authResource,
  isLoaded,
  defaultErrorMessage = 'No se pudo completar el acceso con Google. Intente nuevamente.',
  timeoutMs = 20000
}) {
  const [redirigiendoGoogle, setRedirigiendoGoogle] = useState(false);
  const [errorGoogle, setErrorGoogle] = useState(null);
  const timeoutRef = useRef(null);

  const limpiarTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    // Si el usuario regresa usando el historial (Back/Forward Cache), event.persisted es true
    const handlePageShow = (event) => {
      if (event.persisted) {
        limpiarTimeout();
        setRedirigiendoGoogle(false);
      }
    };

    // Si la pestaña vuelve a tener foco / visibilidad
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        limpiarTimeout();
        setRedirigiendoGoogle(false);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      limpiarTimeout();
    };
  }, []);

  const iniciarOAuth = async () => {
    if (!isLoaded || !authResource) return;
    setErrorGoogle(null);
    setRedirigiendoGoogle(true);
    limpiarTimeout();

    timeoutRef.current = setTimeout(() => {
      setRedirigiendoGoogle(false);
      setErrorGoogle(
        TEXTOS.login?.noCompletadoGoogle ||
          'No se completó el ingreso con Google. Intente de nuevo.'
      );
      timeoutRef.current = null;
    }, timeoutMs);

    try {
      await authResource.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/reservas'
      });
    } catch (err) {
      limpiarTimeout();
      setRedirigiendoGoogle(false);
      setErrorGoogle(err?.errors?.[0]?.longMessage || err?.message || defaultErrorMessage);
    }
  };

  return {
    redirigiendoGoogle,
    errorGoogle,
    setErrorGoogle,
    iniciarOAuth
  };
}

export default useGoogleOAuth;
