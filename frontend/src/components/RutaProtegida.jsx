import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import EsperaDeSesion from './EsperaDeSesion.jsx';

const RutaProtegida = ({ children }) => {
  const { isLoaded, isSignedIn } = useUser();
  const { usuario } = useAuth();

  if (!isLoaded) return <EsperaDeSesion />;

  if (!isSignedIn && !usuario) return <Navigate to="/login" replace />;

  return children;
};

export default RutaProtegida;
