import { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { TEXTOS } from '../../textos.js';

/**
 * Resultado de pedirle a Clerk que verifique unas credenciales.
 *
 * `pendiente` es el caso raro: Clerk aceptó la contraseña pero pide otro factor
 * antes de abrir la sesión. Hay que distinguirlo de un rechazo, porque las
 * credenciales eran correctas y reintentarlas contra la base propia devolvería
 * «credenciales inválidas», que sería mentira.
 */
const ENTRO = { entro: true };
const NO_ENTRO = { entro: false };

/**
 * Pide a Clerk que verifique el correo y la contraseña.
 *
 * Cualquier fallo —credenciales que Clerk no reconoce, pero también que no
 * responda— termina en `NO_ENTRO`, para que el ingreso siga con la vía local.
 * Que un corte de conexión con Clerk no deje afuera a las cuentas semilla es
 * justamente lo que hace que la demostración siga funcionando sin internet.
 */
const verificarConClerk = async ({ signIn, setActive, email, password }) => {
  try {
    const resultado = await signIn.create({ identifier: email, password });

    if (resultado.status === 'complete') {
      await setActive({ session: resultado.createdSessionId });
      return ENTRO;
    }

    return { entro: false, pendiente: true };
  } catch {
    return NO_ENTRO;
  }
};

/**
 * Ingreso por correo y contraseña.
 *
 * Hay dos lugares donde puede vivir una contraseña: Clerk, para las cuentas que
 * se dieron de alta desde la aplicación, y la tabla `usuarios`, para las cuentas
 * semilla de la demostración. Antes el formulario solo preguntaba a la segunda,
 * así que quien se registraba por Clerk no podía volver a entrar nunca: su fila
 * local existe, pero con `passwordHash` nulo, y el ingreso local la rechaza.
 *
 * Por eso se pregunta a los dos, en este orden: primero Clerk, que es donde
 * están las personas reales, y después la base propia. El orden importa poco
 * para quien ingresa y mucho para el limitador de intentos: solo la segunda vía
 * llega a `POST /auth/login`, así que un ingreso correcto por Clerk no gasta
 * cupo.
 */
export const useIngreso = ({ alIngresar } = {}) => {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { iniciarSesionLocal } = useAuth();

  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const ingresar = async ({ email, password }) => {
    setError(null);
    setCargando(true);

    try {
      // Si el SDK todavía no cargó, la vía local sigue estando: no depende de él.
      if (isLoaded && signIn) {
        const resultado = await verificarConClerk({ signIn, setActive, email, password });
        if (resultado.entro) return true;
        if (resultado.pendiente) {
          setError(TEXTOS.login.requiereOtroFactor);
          return false;
        }
      }

      await iniciarSesionLocal(email, password);
      return true;
    } catch (err) {
      setError(err.message || TEXTOS.login.credencialesInvalidas);
      return false;
    } finally {
      setCargando(false);
    }
  };

  const ingresarYSeguir = async (credenciales) => {
    const entro = await ingresar(credenciales);
    if (entro) alIngresar?.();
    return entro;
  };

  return { isLoaded, signIn, error, setError, cargando, ingresar: ingresarYSeguir };
};

export default useIngreso;
