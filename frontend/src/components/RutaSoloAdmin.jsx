import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import EsperaDeSesion from './EsperaDeSesion.jsx';

/**
 * Las mismas reglas de espera que `RutaProtegida`, más el rol.
 *
 * El rol sale de `usuario`, que es la fila de PostgreSQL, y ya no de
 * `publicMetadata` de Clerk. Esa copia puede estar vieja, y el ADR 0002 dice
 * que la fuente de verdad del rol es la base. El backend siempre la releyó; el
 * frontend decidía qué mostrar mirando la copia.
 */
const RutaSoloAdmin = ({ children }) => {
  const { isLoaded, isSignedIn } = useUser();
  const { usuario, cargandoPerfil } = useAuth();

  if (cargandoPerfil) return <EsperaDeSesion />;
  if (!isLoaded && !usuario) return <EsperaDeSesion />;

  if (!isSignedIn && !usuario) return <Navigate to="/login" replace />;
  if (usuario?.rol !== 'admin') return <Navigate to="/reservas" replace />;

  return children;
};

export default RutaSoloAdmin;
