import { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Field, Input, Toast } from '../components/ui/index.js';
import { useAuth } from '../context/AuthContext.jsx';
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

export default function Login() {
  const { iniciarSesionLocal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mensajeInicial = location.state?.mensaje || null;

  const { isLoaded, signIn } = useSignIn();
  const { redirigiendoGoogle, errorGoogle, setErrorGoogle, iniciarOAuth } = useGoogleOAuth({
    authResource: signIn,
    isLoaded,
    defaultErrorMessage: TEXTOS.login.errorGoogle
  });

  const [form, setForm] = useState({ email: '', password: '' });
  const [erroresCampo, setErroresCampo] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(() => {
    try {
      const authError = sessionStorage.getItem('auth_error');
      if (authError) {
        sessionStorage.removeItem('auth_error');
        return authError;
      }
    } catch {
      return location.state?.error || null;
    }
    return location.state?.error || null;
  });
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
    if (!form.email.trim()) {
      nuevosErrores.email = 'Ingrese su correo electrónico.';
    } else if (!form.email.includes('@')) {
      nuevosErrores.email = 'Ingrese un correo electrónico válido.';
    }
    if (!form.password) {
      nuevosErrores.password = 'Ingrese su contraseña.';
    }
    setErroresCampo(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmitLocal = async (evento) => {
    evento.preventDefault();
    setErrorGeneral(null);
    setErrorGoogle(null);

    if (!validar()) return;

    setCargando(true);
    try {
      await iniciarSesionLocal(form.email.trim(), form.password);
      navigate('/reservas');
    } catch (err) {
      setErrorGeneral(err.message || 'Credenciales inválidas');
    } finally {
      setCargando(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorGeneral(null);
    await iniciarOAuth();
  };

  return (
    <main className={styles.contenedor}>
      <div className={styles.panel}>
        <header className={styles.cabecera}>
          <h1 className={styles.titulo}>{TEXTOS.login.titulo}</h1>
          <p className={styles.subtitulo}>{TEXTOS.login.subtitulo}</p>
        </header>

        {mensajeInicial ? <Toast tipo="exito" mensaje={mensajeInicial} /> : null}
        {errorGeneral ? (
          <Toast tipo="error" mensaje={errorGeneral} onCerrar={() => setErrorGeneral(null)} />
        ) : null}
        {errorGoogle ? (
          <Toast tipo="error" mensaje={errorGoogle} onCerrar={() => setErrorGoogle(null)} />
        ) : null}

        <form onSubmit={handleSubmitLocal} className={styles.formulario} noValidate>
          <Field id="email" etiqueta={TEXTOS.login.correo} error={erroresCampo.email} obligatorio>
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
            etiqueta={TEXTOS.login.contrasena}
            error={erroresCampo.password}
            obligatorio
          >
            <Input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </Field>

          <Button type="submit" variante="primario" bloque cargando={cargando}>
            {TEXTOS.login.ingresar}
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
            onClick={handleGoogleLogin}
          >
            {TEXTOS.login.continuarGoogle}
          </Button>
        </div>

        <footer className={styles.pie}>
          {TEXTOS.login.sinCuenta}{' '}
          <Link to="/register" className={styles.enlace}>
            {TEXTOS.login.crearCuenta}
          </Link>
        </footer>
      </div>
    </main>
  );
}
