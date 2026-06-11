import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const RutaProtegida = ({ children }) => {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
};

export default RutaProtegida;