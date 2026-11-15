import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import EsperaDeSesion from './EsperaDeSesion.jsx';

/**
 * Solo se espera cuando esperar puede cambiar la respuesta.
 *
 * Antes la guarda era `if (!isLoaded)` a secas, y eso encerraba a quien tuviera
 * sesión local mientras Clerk no cargara. El problema es que la salida de
 * `EsperaDeSesion` lleva justamente al ingreso local: alguien podía entrar con
 * su cuenta, volver acá, y encontrarse de nuevo con la misma pantalla de espera.
 * La salida existía y no salía a ningún lado.
 *
 * Con una sesión local andando, lo que diga Clerk ya no importa. Y con sesión
 * de Clerk sí hay que esperar al perfil que pide `AuthContext`, porque hasta que
 * llegue no se sabe con qué identificador ni con qué rol se está operando.
 */
const RutaProtegida = ({ children }) => {
  const { isLoaded, isSignedIn } = useUser();
  const { usuario, cargandoPerfil } = useAuth();

  if (cargandoPerfil) return <EsperaDeSesion />;
  if (!isLoaded && !usuario) return <EsperaDeSesion />;

  if (!isSignedIn && !usuario) return <Navigate to="/login" replace />;

  return children;
};

export default RutaProtegida;
