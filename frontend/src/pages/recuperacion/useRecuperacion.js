import { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { TEXTOS } from '../../textos.js';

const ESTRATEGIA = 'reset_password_email_code';

/** Clerk devuelve sus errores en `errors[]`; el primero es el que se muestra. */
const mensajeDeClerk = (err, porDefecto) =>
  err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || porDefecto;

/**
 * Restablecer la contraseña olvidada.
 *
 * Solo alcanza a las cuentas de Clerk, que son las que se dan de alta desde la
 * aplicación. Las cuentas sembradas tienen su contraseña en la base del
 * proyecto y Clerk no sabe nada de ellas: la pantalla lo dice de entrada, para
 * que nadie quede esperando un correo que no va a llegar.
 *
 * El primer paso **no informa si el correo existe**. Pedir un código para una
 * dirección cualquiera y que la respuesta cambie según exista o no convierte
 * esta pantalla en una forma de averiguar quién tiene cuenta. Así que se avanza
 * al paso del código en los dos casos y el mensaje es el mismo; si la cuenta no
 * existía, el código simplemente nunca va a validar.
 */
export const useRecuperacion = ({ alCompletar } = {}) => {
  const { isLoaded, signIn, setActive } = useSignIn();

  const [paso, setPaso] = useState('correo');
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const pedirCodigo = async (email) => {
    if (!isLoaded) return;
    setError(null);
    setEnviando(true);

    try {
      await signIn.create({ strategy: ESTRATEGIA, identifier: email });
    } catch {
      // A propósito: un correo desconocido no se distingue de uno conocido.
    } finally {
      setEnviando(false);
    }

    setAviso(TEXTOS.recuperacion.codigoEnviado);
    setPaso('codigo');
  };

  const restablecer = async ({ codigo, contrasena }) => {
    if (!isLoaded) return;
    setError(null);
    setAviso(null);
    setEnviando(true);

    try {
      const resultado = await signIn.attemptFirstFactor({
        strategy: ESTRATEGIA,
        code: codigo,
        password: contrasena
      });

      if (resultado.status !== 'complete') {
        setError(TEXTOS.recuperacion.requiereOtroFactor);
        return;
      }

      await setActive({ session: resultado.createdSessionId });
      alCompletar?.();
    } catch (err) {
      setError(mensajeDeClerk(err, TEXTOS.recuperacion.errorCodigo));
    } finally {
      setEnviando(false);
    }
  };

  const volverAlCorreo = () => {
    setError(null);
    setAviso(null);
    setPaso('correo');
  };

  return { isLoaded, paso, error, aviso, enviando, pedirCodigo, restablecer, volverAlCorreo };
};

export default useRecuperacion;
