import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="fade-in" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '80px', fontWeight: 700, background: 'linear-gradient(180deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '16px' }}>
          404
        </div>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Página no encontrada</h1>
        <p style={{ color: 'var(--text-soft)', fontSize: '16px', marginBottom: '32px', maxWidth: '400px' }}>
          La ruta que buscas no existe. Quizás estés buscando otra página.
        </p>
        <button 
          onClick={() => navigate('/reservas')} 
          className="btn-primary"
          style={{ padding: '12px 32px', fontSize: '16px' }}
        >
          ← Volver al inicio
        </button>
      </div>
    </div>
  );
};

export default NotFound;