import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Callback = () => {
  const { procesarCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) return 'Error al iniciar sesión: ' + errorParam;
    if (!params.get('code')) return 'No se recibió código de autorización';
    return null;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');

    if (errorParam || !code) {
      return;
    }

    procesarCallback(code)
      .then(() => navigate('/reservas'))
      .catch(() => setError('Error al procesar el login. Intentá de nuevo.'));
  }, [navigate, procesarCallback]);

  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  return <p>Procesando login...</p>;
};

export default Callback;