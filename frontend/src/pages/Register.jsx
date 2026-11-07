import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/auth.service.js';

const Register = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validación básica
    if (!form.nombre.trim()) {
      setError('Por favor ingresa tu nombre');
      return;
    }
    if (!form.email.includes('@')) {
      setError('Por favor ingresa un email válido');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setCargando(true);
    try {
      await register(form.nombre, form.email, form.password);
      navigate('/login', { state: { mensaje: 'Cuenta creada exitosamente. Por favor inicia sesión.' } });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al registrarse';
      if (errorMsg.includes('email') || errorMsg.includes('ya existe')) {
        setError('Este email ya está registrado');
      } else {
        setError(errorMsg);
      }
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
      padding: '20px',
      backgroundColor: '#f9fafb'
    }}>
      <div className="card fade-in" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px'
      }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '8px'
          }}>
            📚 Crear cuenta
          </div>
          <p style={{
            color: '#6b7280',
            fontSize: '14px',
            margin: 0
          }}>
            Únete al sistema de reservas de aulas
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#111827',
              marginBottom: '6px'
            }}>
              Nombre completo
            </label>
            <input
              type="text"
              name="nombre"
              placeholder="Tu nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#111827',
              marginBottom: '6px'
            }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="tu@email.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#111827',
              marginBottom: '6px'
            }}>
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
            <p style={{
              fontSize: '11px',
              color: '#9ca3af',
              margin: '4px 0 0'
            }}>
              Mínimo 6 caracteres
            </p>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#111827',
              marginBottom: '6px'
            }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary"
            disabled={cargando}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {cargando ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          ¿Ya tienes cuenta?{' '}
          <Link 
            to="/login"
            style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'color 200ms'
            }}
            onMouseOver={(e) => e.target.style.color = '#1d4ed8'}
            onMouseOut={(e) => e.target.style.color = '#2563eb'}
          >
            Inicia sesión aquí
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;