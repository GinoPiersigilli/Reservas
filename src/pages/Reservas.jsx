
import { useAuth } from '../context/AuthContext.jsx';

const { usuario, cerrarSesion, getToken, isLoaded } = useAuth();


useEffect(() => {
  if (!isLoaded) return;

  const cargar = async () => {
    if (getToken) {
      const { setAuthToken } = await import('../services/axios.js');
      const token = await getToken();
      setAuthToken(token);
    }
    cargarReservas();
  };

  cargar();
}, [filtros, pagina, isLoaded]);