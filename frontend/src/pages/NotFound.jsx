import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      backgroundColor: '#f9fafb'
    }}>
      <div className="fade-in" style={{ textAlign: 'center', maxWidth: '500px' }}>
        <div style={{
          fontSize: '72px',
          fontWeight: 700,
          color: '#2563eb',
          marginBottom: '16px'
        }}>
          404
        </div>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '8px'
        }}>
          Página no encontrada
        </h1>
        <p style={{
          color: '#6b7280',
          fontSize: '16px',
          marginBottom: '32px',
          lineHeight: '1.6'
        }}>
          La ruta que buscas no existe. Quizás hayas escrito incorrectamente la URL o la página fue removida.
        </p>
        <button 
          onClick={() => navigate('/reservas')} 
          className="btn-primary"
          style={{ padding: '12px 32px', fontSize: '16px' }}
        >
          ← Volver a mis reservas
        </button>
      </div>
    </div>
  );
};

export default NotFound;