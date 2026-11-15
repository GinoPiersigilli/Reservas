import { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { TEXTOS } from '../../textos.js';

const ESTRATEGIA = 'reset_password_email_code';

/** Clerk avisa así que ese correo no tiene cuenta. */
const esCuentaInexistente = (err) =>
  err?.errors?.some((e) => e?.code === 'form_identifier_not_found');

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
  /**
   * Si el paso 1 dejó un intento de verdad abierto en Clerk.
   *
   * Cuando el correo no existe, `signIn.create` falla y no queda ningún intento
   * activo. Igual se avanza al paso del código —no revelar nada es el punto—
   * pero hay que recordarlo: llamar a `attemptFirstFactor` sin intento activo
   * devuelve un error de Clerk que dice justamente que no hay un inicio de
   * sesión en curso, y mostrarlo delataría lo que el paso 1 calló.
   */
  const [hayIntento, setHayIntento] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const pedirCodigo = async (email) => {
    if (!isLoaded) return;
    setError(null);
    setEnviando(true);

    try {
      await signIn.create({ strategy: ESTRATEGIA, identifier: email });
      setHayIntento(true);
    } catch (err) {
      // Un correo sin cuenta sigue adelante como si nada: no revelar cuáles
      // existen es el punto de esta pantalla.
      if (!esCuentaInexistente(err)) {
        // Lo demás —la red cortada, un 429 de Clerk— sí se dice. Avisar que se
        // envió un código cuando la petición ni salió deja a la persona
        // esperando un correo que nadie mandó.
        setError(mensajeDeClerk(err, TEXTOS.recuperacion.errorEnvio));
        setEnviando(false);
        return;
      }
      setHayIntento(false);
    }

    setEnviando(false);
    setAviso(TEXTOS.recuperacion.codigoEnviado);
    setPaso('codigo');
  };

  const restablecer = async ({ codigo, contrasena }) => {
    if (!isLoaded) return;
    setError(null);
    setAviso(null);
    setEnviando(true);

    // Sin intento abierto, el código no puede ser válido. Se responde igual
    // que ante un código equivocado: el motivo real diría que la cuenta del
    // paso 1 no existe.
    if (!hayIntento) {
      setError(TEXTOS.recuperacion.errorCodigo);
      setEnviando(false);
      return;
    }

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
    setHayIntento(false);
    setPaso('correo');
  };

  return { isLoaded, paso, error, aviso, enviando, pedirCodigo, restablecer, volverAlCorreo };
};

export default useRecuperacion;
