import { useState } from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const clerkAppearance = {
  variables: {
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorInputText: '#111827',
    colorText: '#111827',
    colorTextSecondary: '#6b7280',
    colorPrimary: '#2563eb',
    colorDanger: '#dc2626',
    borderRadius: '6px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
  },
  elements: {
    card: {
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderRadius: '8px',
    },
    headerTitle: {
      color: '#111827',
      fontSize: '20px',
      fontWeight: '600',
    },
    headerSubtitle: {
      color: '#6b7280',
    },
    socialButtonsBlockButton: {
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
      color: '#111827',
      borderRadius: '6px',
    },
    socialButtonsBlockButtonText: {
      color: '#111827',
    },
    dividerLine: {
      background: '#e5e7eb',
    },
    dividerText: {
      color: '#6b7280',
    },
    formFieldInput: {
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      color: '#111827',
      borderRadius: '6px',
    },
    formFieldLabel: {
      color: '#111827',
    },
    formButtonPrimary: {
      background: '#2563eb',
      borderRadius: '6px',
      fontWeight: '600',
    },
    footerActionLink: {
      color: '#2563eb',
    },
    identityPreviewText: {
      color: '#111827',
    },
    identityPreviewEditButton: {
      color: '#2563eb',
    },
    badge: {
      background: '#eff6ff',
      color: '#2563eb',
    },
  }
};

const Login = () => {
  const { iniciarSesionLocal } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState('local');
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
      navigate('/reservas');
    } catch (err) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '16px',
      backgroundColor: '#f9fafb'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px'
      }}>
        {/* Logo / Icon */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '32px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#2563eb'
          }}>
            📚
          </div>
        </div>

        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#111827',
            margin: '0 0 8px'
          }}>
            Sistema de Reservas
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: 0
          }}>
            Gestión de aulas universitarias
          </p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {/* Mode Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            backgroundColor: '#f9fafb',
            padding: '4px',
            borderRadius: '6px'
          }}>
            <button
              type="button"
              onClick={() => setModo('local')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: modo === 'local' ? '#ffffff' : 'transparent',
                color: modo === 'local' ? '#111827' : '#6b7280',
                fontWeight: modo === 'local' ? 500 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 150ms ease-in-out',
                borderBottom: modo === 'local' ? '2px solid #2563eb' : '2px solid transparent'
              }}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => setModo('clerk')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: modo === 'clerk' ? '#ffffff' : 'transparent',
                color: modo === 'clerk' ? '#111827' : '#6b7280',
                fontWeight: modo === 'clerk' ? 500 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 150ms ease-in-out',
                borderBottom: modo === 'clerk' ? '2px solid #2563eb' : '2px solid transparent'
              }}
            >
              SSO
            </button>
          </div>

          {/* Local Login */}
          {modo === 'local' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Test Credentials Info */}
              <div style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '12px',
                color: '#1e40af'
              }}>
                <strong style={{ display: 'block', marginBottom: '6px', color: '#1d4ed8' }}>
                  Credenciales de prueba
                </strong>
                <div style={{ lineHeight: '1.6' }}>
                  <div><strong>Admin:</strong> admin@utnfrc.edu.ar / admin123</div>
                  <div><strong>Usuario:</strong> david@utnfrc.edu.ar / user123</div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitLocal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="email" style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#111827',
                    marginBottom: '6px'
                  }}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="usuario@ejemplo.com"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: '#111827',
                      backgroundColor: '#ffffff',
                      transition: 'border-color 150ms, box-shadow 150ms'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563eb';
                      e.target.style.boxShadow = '0 0 0 3px #eff6ff';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="password" style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#111827',
                    marginBottom: '6px'
                  }}>
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: '#111827',
                      backgroundColor: '#ffffff',
                      transition: 'border-color 150ms, box-shadow 150ms'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563eb';
                      e.target.style.boxShadow = '0 0 0 3px #eff6ff';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {error && (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '13px',
                    color: '#dc2626'
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={cargando}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    backgroundColor: cargando ? '#9ca3af' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: cargando ? 'not-allowed' : 'pointer',
                    transition: 'background-color 150ms',
                    opacity: cargando ? 0.7 : 1
                  }}
                  onMouseOver={(e) => !cargando && (e.target.style.backgroundColor = '#1d4ed8')}
                  onMouseOut={(e) => !cargando && (e.target.style.backgroundColor = '#2563eb')}
                >
                  {cargando ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>
            </div>
          )}

          {/* Clerk Login */}
          {modo === 'clerk' && (
            <div style={{ marginTop: '-28px', marginLeft: '-28px', marginRight: '-28px', marginBottom: '-28px' }}>
              <SignIn
                routing="hash"
                redirectUrl="/reservas"
                appearance={{
                  ...clerkAppearance,
                  elements: {
                    ...clerkAppearance.elements,
                    rootBox: { width: '100%' },
                    card: {
                      ...clerkAppearance.elements.card,
                      padding: '28px',
                      boxShadow: 'none',
                      border: 'none',
                      background: '#ffffff',
                      borderRadius: '8px',
                    },
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#9ca3af',
          marginTop: '20px',
          margin: '20px 0 0'
        }}>
          Sistema seguro de gestión de reservas · 2026
        </p>
      </div>
    </div>
  );
};

export default Login;