import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const Login = () => {
  const { iniciarLogin, iniciarSesionLocal } = useAuth();
  const [modo, setModo] = useState('keycloak'); // 'keycloak' o 'local'
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmitLocal = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await iniciarSesionLocal(form.email, form.password);
    } catch (err) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="auth-container fade-in">
      <section className="auth-card stack">
        <div className="center">
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="12" width="48" height="40" rx="10" fill="rgba(255,255,255,0.08)" />
            <path d="M18 22H46" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <path d="M18 30H46" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <path d="M18 38H30" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        <div className="stack">
          <h1 className="page-title">Sistema de Reservas de Aulas</h1>
          <p className="text-muted">Iniciá sesión para continuar.</p>
        </div>

        {/* Selector de modo */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '4px' }}>
          <button
            type="button"
            onClick={() => setModo('keycloak')}
            style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: modo === 'keycloak' ? 'var(--primary)' : 'transparent',
              color: 'white', fontWeight: 500, fontSize: '14px'
            }}
          >
            Keycloak
          </button>
          <button
            type="button"
            onClick={() => setModo('local')}
            style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: modo === 'local' ? 'var(--primary)' : 'transparent',
              color: 'white', fontWeight: 500, fontSize: '14px'
            }}
          >
            Usuario local
          </button>
        </div>

        {/* Login Keycloak */}
        {modo === 'keycloak' && (
          <div className="stack">
            <p className="text-muted small">Usá tu cuenta institucional de Keycloak.</p>
            <button type="button" className="btn-primary row center" onClick={iniciarLogin}>
              <span>Iniciar sesión con Keycloak</span>
            </button>
          </div>
        )}

        {/* Login local */}
        {modo === 'local' && (
          <form onSubmit={handleSubmitLocal} className="stack">
            <p className="text-muted small">
              Usuarios de prueba: <strong>admin@utnfrc.edu.ar</strong> / admin123 · <strong>david@utnfrc.edu.ar</strong> / user123
            </p>
            <div className="form-row">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="usuario@ejemplo.com"
                required
              />
            </div>
            <div className="form-row">
              <label>Contraseña</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '14px' }}>{error}</p>}
            <button type="submit" className="btn-primary" disabled={cargando}>
              {cargando ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
};

export default Login;