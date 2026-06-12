import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/auth.service.js';

const Register = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
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
      await register(form.nombre, form.email, form.password);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card fade-in">
        <h1>Crear cuenta</h1>
        <p className="subtitle">Únete para empezar a gestionar tus reservas</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <label htmlFor="nombre">Nombre completo</label>
            <input
              id="nombre"
              type="text"
              name="nombre"
              placeholder="Tu nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>
          
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
            {cargando ? <span className="loader"></span> : 'Registrarse'}
          </button>
        </form>
        
        <div className="auth-footer">
          ¿Ya tenés cuenta? <Link to="/login">Inicia sesión</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;