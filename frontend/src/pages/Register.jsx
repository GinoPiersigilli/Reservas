import { useState } from 'react';
import { useSignUp } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Field, Input, Toast } from '../components/ui/index.js';
import { register } from '../services/auth.service.js';
import { useGoogleOAuth } from '../hooks/useGoogleOAuth.js';
import { TEXTOS } from '../textos.js';
import styles from './Auth.module.css';

function GoogleIcon({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function Register() {
  const navigate = useNavigate();

  const { isLoaded, signUp } = useSignUp();
  const {
    redirigiendoGoogle,
    errorGoogle,
    setErrorGoogle,
    iniciarOAuth
  } = useGoogleOAuth({
    authResource: signUp,
    isLoaded,
    defaultErrorMessage: TEXTOS.registro.errorGoogle
  });

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [erroresCampo, setErroresCampo] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleChange = (evento) => {
    const { name, value } = evento.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (erroresCampo[name]) {
      setErroresCampo((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validar = () => {
    const nuevosErrores = {};
    if (!form.nombre.trim()) {
      nuevosErrores.nombre = 'Ingrese su nombre completo.';
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      nuevosErrores.email = 'Ingrese un correo electrónico válido.';
    }
    if (!form.password || form.password.length < 6) {
      nuevosErrores.password = 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (form.password !== form.confirmPassword) {
      nuevosErrores.confirmPassword = 'Las contraseñas no coinciden.';
    }
    setErroresCampo(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    setErrorGeneral(null);
    setErrorGoogle(null);

    if (!validar()) return;

    setCargando(true);
    try {
      await register(form.nombre.trim(), form.email.trim(), form.password);
      navigate('/login', {
        state: { mensaje: 'Cuenta creada. Ingrese con sus credenciales.' }
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'No se pudo completar el registro.';
      if (errorMsg.toLowerCase().includes('email') || errorMsg.toLowerCase().includes('ya existe')) {
        setErroresCampo({ email: 'Este email ya está registrado.' });
        setErrorGeneral(errorMsg);
      } else {
        setErrorGeneral(errorMsg);
      }
    } finally {
      setCargando(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErrorGeneral(null);
    await iniciarOAuth();
  };

  return (
    <main className={styles.contenedor}>
      <div className={styles.panel}>
        <header className={styles.cabecera}>
          <h1 className={styles.titulo}>{TEXTOS.registro.titulo}</h1>
          <p className={styles.subtitulo}>{TEXTOS.registro.subtitulo}</p>
        </header>

        {errorGeneral ? (
          <Toast tipo="error" mensaje={errorGeneral} onCerrar={() => setErrorGeneral(null)} />
        ) : null}
        {errorGoogle ? (
          <Toast tipo="error" mensaje={errorGoogle} onCerrar={() => setErrorGoogle(null)} />
        ) : null}

        <form onSubmit={handleSubmit} className={styles.formulario} noValidate>
          <Field
            id="nombre"
            etiqueta={TEXTOS.registro.nombre}
            error={erroresCampo.nombre}
            obligatorio
          >
            <Input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              autoComplete="name"
            />
          </Field>

          <Field
            id="email"
            etiqueta={TEXTOS.registro.correo}
            error={erroresCampo.email}
            obligatorio
          >
            <Input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
          </Field>

          <Field
            id="password"
            etiqueta={TEXTOS.registro.contrasena}
            ayuda="Mínimo 6 caracteres."
            error={erroresCampo.password}
            obligatorio
          >
            <Input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </Field>

          <Field
            id="confirmPassword"
            etiqueta={TEXTOS.registro.confirmarContrasena}
            error={erroresCampo.confirmPassword}
            obligatorio
          >
            <Input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </Field>

          <Button type="submit" variante="primario" bloque cargando={cargando}>
            {TEXTOS.registro.registrar}
          </Button>
        </form>

        <div className={styles.separador} aria-hidden="true">
          <span>{TEXTOS.login.separadorO}</span>
        </div>

        <div className={styles.bloqueClerk}>
          <Button
            type="button"
            variante="secundario"
            bloque
            disabled={!isLoaded || redirigiendoGoogle || cargando}
            cargando={redirigiendoGoogle}
            aria-busy={redirigiendoGoogle}
            icono={GoogleIcon}
            onClick={handleGoogleSignUp}
          >
            {TEXTOS.registro.registrarseGoogle}
          </Button>
        </div>

        <footer className={styles.pie}>
          {TEXTOS.registro.conCuenta}{' '}
          <Link to="/login" className={styles.enlace}>
            {TEXTOS.registro.ingresar}
          </Link>
        </footer>
      </div>
    </main>
  );
}
