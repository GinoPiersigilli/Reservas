import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { login } from '../services/auth.service.js';

const Login = () => {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await login(form.email, form.password);
      iniciarSesion(res.data.token, res.data.usuario);
      navigate('/reservas');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card fade-in">
        <h1>Iniciar sesión</h1>
        <p className="subtitle">Accede a tu cuenta para gestionar reservas</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="tu@email.com"
              value={form.email}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>
          
          <div className="form-row">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          
          {error && <div className="alert alert--error">{error}</div>}
          
          <button type="submit" className="btn-primary" disabled={cargando} style={{ width: '100%' }}>
            {cargando ? <span className="loader"></span> : 'Ingresar'}
          </button>
        </form>
        
        <div className="auth-footer">
          ¿No tenés cuenta? <Link to="/register">Crea una aquí</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;