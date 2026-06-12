import { useAuth } from '../context/AuthContext.jsx';

const Login = () => {
  const { iniciarLogin } = useAuth();

  return (
    <main className="auth-container fade-in">
      <section className="auth-card stack">
        <div className="center">
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="8" y="12" width="48" height="40" rx="10" fill="rgba(255,255,255,0.08)" />
            <path d="M18 22H46" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <path d="M18 30H46" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <path d="M18 38H30" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <path d="M24 48H32" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        <div className="stack">
          <h1 className="page-title">Sistema de Reservas de Aulas</h1>
          <p className="text-muted">Iniciá sesión con tu cuenta institucional para continuar.</p>
          <p className="text-muted small">Gestioná aulas, horarios y recursos con una experiencia segura y fluida.</p>
        </div>

        <button type="button" className="btn-primary row center" onClick={iniciarLogin}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 11.8 6.95 14.16 9.5 14.82V17H8.5C8.22 17 8 17.22 8 17.5V20.5C8 20.78 8.22 21 8.5 21H15.5C15.78 21 16 20.78 16 20.5V17.5C16 17.22 15.78 17 15.5 17H14.5V14.82C17.05 14.16 19 11.8 19 9C19 5.13 15.87 2 12 2Z" fill="white" />
            <path d="M14.5 17H9.5V14.82C7.88 14.34 6.75 12.88 6.75 11.09C6.75 8.68 8.68 6.75 11.09 6.75C13.5 6.75 15.43 8.68 15.43 11.09C15.43 12.88 14.3 14.34 12.68 14.82V17Z" fill="#F9FAFB" opacity="0.3" />
          </svg>
          <span>Iniciar sesión con Keycloak</span>
        </button>
      </section>
    </main>
  );
};

export default Login;
