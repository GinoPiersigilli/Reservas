import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import EsperaDeSesion from './EsperaDeSesion.jsx';

const RutaSoloAdmin = ({ children }) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const auth = useAuth();
  const usuario = auth?.usuario;
  const rol = user?.publicMetadata?.rol || usuario?.rol;

  if (!isLoaded) return <EsperaDeSesion />;
  if (!isSignedIn && !usuario) return <Navigate to="/login" replace />;
  if (rol !== 'admin') return <Navigate to="/reservas" replace />;

  return children;
};

export default RutaSoloAdmin;
