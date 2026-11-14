import { useState } from 'react';
import { useSignUp } from '@clerk/clerk-react';
import { TEXTOS } from '../../textos.js';

/** Clerk devuelve sus errores en `errors[]`; el primero es el que se muestra. */
const mensajeDeClerk = (err, porDefecto) =>
  err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || porDefecto;

/**
 * Clerk acepta nombre y apellido por separado. El formulario pide un nombre
 * completo, así que la primera palabra es el nombre y el resto el apellido:
 * es como lo arma de vuelta el backend al dar de alta la cuenta local.
 */
const partirNombre = (completo) => {
  const partes = String(completo || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return {};
  return { firstName: partes[0], lastName: partes.slice(1).join(' ') || partes[0] };
};

/**
 * Alta de cuenta contra Clerk.
 *
 * La identidad es responsabilidad de Clerk (ver docs/adr/0002): no hay registro
 * local, y el backend crea la cuenta en su base la primera vez que ve un token
 * válido. Por eso el formulario habla con el SDK y no con la API propia.
 *
 * Clerk puede pedir verificar el correo antes de abrir la sesión. El flujo
 * queda en dos pasos: `registrar` crea la cuenta y, si hace falta, pide el
 * código; `verificar` lo confirma. Cuando la instancia de Clerk no exige
 * verificación, el primer paso ya deja la sesión abierta.
 */
export const useRegistroClerk = ({ alCompletar } = {}) => {
  const { isLoaded, signUp, setActive } = useSignUp();

  const [paso, setPaso] = useState('datos');
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const abrirSesion = async (resultado) => {
    await setActive({ session: resultado.createdSessionId });
    alCompletar?.();
  };

  const registrar = async ({ nombre, email, password }) => {
    if (!isLoaded) return;
    setError(null);
    setAviso(null);
    setEnviando(true);

    try {
      const resultado = await signUp.create({
        emailAddress: email,
        password,
        ...partirNombre(nombre)
      });

      if (resultado.status === 'complete') {
        await abrirSesion(resultado);
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPaso('verificacion');
    } catch (err) {
      setError(mensajeDeClerk(err, TEXTOS.registro.errorRegistro));
    } finally {
      setEnviando(false);
    }
  };

  const verificar = async (codigo) => {
    if (!isLoaded) return;
    setError(null);
    setAviso(null);
    setEnviando(true);

    try {
      const resultado = await signUp.attemptEmailAddressVerification({ code: codigo });

      if (resultado.status !== 'complete') {
        setError(TEXTOS.registro.errorCodigo);
        return;
      }

      await abrirSesion(resultado);
    } catch (err) {
      setError(mensajeDeClerk(err, TEXTOS.registro.errorCodigo));
    } finally {
      setEnviando(false);
    }
  };

  const reenviarCodigo = async () => {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setAviso(TEXTOS.registro.codigoEnviado);
    } catch (err) {
      setError(mensajeDeClerk(err, TEXTOS.registro.errorRegistro));
    }
  };

  return {
    isLoaded,
    signUp,
    paso,
    error,
    setError,
    aviso,
    setAviso,
    enviando,
    registrar,
    verificar,
    reenviarCodigo
  };
};

export default useRegistroClerk;
