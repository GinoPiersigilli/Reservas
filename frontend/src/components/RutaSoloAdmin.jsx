import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

const RutaSoloAdmin = ({ children }) => {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) return <p>Cargando...</p>;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (user?.publicMetadata?.rol !== 'admin') return <Navigate to="/reservas" replace />;

  return children;
};

export default RutaSoloAdmin;