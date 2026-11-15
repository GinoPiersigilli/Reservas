import { useState } from 'react';
import { useSignUp } from '@clerk/clerk-react';
import { TEXTOS } from '../../textos.js';

/**
 * El mensaje que Clerk trae para mostrar.
 *
 * Solo se usa lo que viene en `errors[]`, que es texto escrito para una
 * persona. El `message` del error no: en un corte de red dice «Failed to
 * fetch», que no le explica nada a nadie y encima es el mensaje crudo de una
 * biblioteca en una pantalla de la aplicación.
 */
const mensajeDeClerk = (err, porDefecto) =>
  err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || porDefecto;

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
 * Confirma el código del correo. Vive fuera del hook porque no necesita nada de
 * React: recibe lo que usa y avisa el resultado por `setError`.
 */
const confirmarCodigo = async ({ signUp, codigo, abrirSesion, setError }) => {
  try {
    const resultado = await signUp.attemptEmailAddressVerification({ code: codigo });

    if (resultado.status !== 'complete') {
      setError(TEXTOS.registro.errorCodigo);
      return;
    }

    await abrirSesion(resultado);
  } catch (err) {
    setError(mensajeDeClerk(err, TEXTOS.registro.errorCodigo));
  }
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
      await confirmarCodigo({ signUp, codigo, abrirSesion, setError });
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Abandona el alta en curso y vuelve al formulario.
   *
   * Clerk no ofrece cancelar un registro empezado: el intento queda de su lado
   * hasta que vence solo. Lo que sí se puede es dejar de usarlo —el próximo
   * `signUp.create` abre uno nuevo—, así que esta salida sirve para corregir un
   * correo mal escrito, que es para lo que se la pide. Reintentar con el mismo
   * correo seguirá chocando con el duplicado, y eso está bien: esa cuenta ya
   * existe y lo que corresponde es ingresar, no volver a crearla.
   */
  const usarOtroCorreo = () => {
    setError(null);
    setAviso(null);
    setPaso('datos');
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
    reenviarCodigo,
    usarOtroCorreo
  };
};

export default useRegistroClerk;
