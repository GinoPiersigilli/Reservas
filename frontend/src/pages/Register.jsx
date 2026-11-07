import { useState } from 'react';
import { SignUp } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Field, Input, Toast } from '../components/ui/index.js';
import { clerkAppearance } from '../config/clerkAppearance.js';
import { register } from '../services/auth.service.js';
import { TEXTOS } from '../textos.js';
import styles from './Auth.module.css';

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
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

  return (
    <main className={styles.contenedor}>
      <div className={styles.panel}>
        <header className={styles.cabecera}>
          <h1 className={styles.titulo}>{TEXTOS.registro.titulo}</h1>
          <p className={styles.subtitulo}>{TEXTOS.registro.subtitulo}</p>
        </header>

        {errorGeneral ? <Toast tipo="error" mensaje={errorGeneral} /> : null}

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
            aria-expanded={mostrarClerk}
            onClick={() => setMostrarClerk((prev) => !prev)}
          >
            Continuar con Clerk / Google
          </Button>

          {mostrarClerk ? (
            <SignUp
              routing="hash"
              redirectUrl="/reservas"
              appearance={clerkAppearance}
            />
          ) : null}
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
