import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const RutaSoloAdmin = ({ children }) => {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== 'admin') return <Navigate to="/reservas" replace />;
  return children;
};

export default RutaSoloAdmin;