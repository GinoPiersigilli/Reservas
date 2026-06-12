import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Callback = () => {
  const { procesarCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');

    if (errorParam) {
      setError('Error al iniciar sesión: ' + errorParam);
      return;
    }

    if (!code) {
      setError('No se recibió código de autorización');
      return;
    }

    procesarCallback(code)
      .then(() => navigate('/reservas'))
      .catch((err) => setError('Error al procesar el login. Intentá de nuevo.'));
  }, []);

  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  return <p>Procesando login...</p>;
};

export default Callback;