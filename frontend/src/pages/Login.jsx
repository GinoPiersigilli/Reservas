import { useState } from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Field, Input, Toast } from '../components/ui/index.js';
import { clerkAppearance } from '../config/clerkAppearance.js';
import { useAuth } from '../context/AuthContext.jsx';
import { TEXTOS } from '../textos.js';
import styles from './Auth.module.css';

export default function Login() {
  const { iniciarSesionLocal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mensajeInicial = location.state?.mensaje || null;

  const [form, setForm] = useState({ email: '', password: '' });
  const [erroresCampo, setErroresCampo] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mostrarClerk, setMostrarClerk] = useState(false);

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

  return (
    <main className={styles.contenedor}>
      <div className={styles.panel}>
        <header className={styles.cabecera}>
          <h1 className={styles.titulo}>{TEXTOS.login.titulo}</h1>
          <p className={styles.subtitulo}>{TEXTOS.login.subtitulo}</p>
        </header>

        {mensajeInicial ? <Toast tipo="exito" mensaje={mensajeInicial} /> : null}
        {errorGeneral ? <Toast tipo="error" mensaje={errorGeneral} /> : null}

        <form onSubmit={handleSubmitLocal} className={styles.formulario} noValidate>
          <Field
            id="email"
            etiqueta={TEXTOS.login.correo}
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
            aria-expanded={mostrarClerk}
            onClick={() => setMostrarClerk((prev) => !prev)}
          >
            Continuar con Clerk / Google
          </Button>

          {mostrarClerk ? (
            <SignIn
              routing="hash"
              redirectUrl="/reservas"
              appearance={clerkAppearance}
            />
          ) : null}
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
