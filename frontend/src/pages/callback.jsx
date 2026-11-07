import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from '../components/ui/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Auth.module.css';

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
      .catch(() => setError('No se pudo procesar el inicio de sesión. Intente de nuevo.'));
  }, [navigate, procesarCallback]);

  return (
    <main className={styles.contenedor}>
      <div className={styles.panel}>
        {error ? <Toast tipo="error" mensaje={error} /> : <p>Procesando inicio de sesión…</p>}
      </div>
    </main>
  );
};

export default Callback;
