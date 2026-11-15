import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Field, Input, Toast } from '../components/ui/index.js';
import { useRecuperacion } from './recuperacion/useRecuperacion.js';
import PasoNuevaContrasena from './recuperacion/PasoNuevaContrasena.jsx';
import { TEXTOS } from '../textos.js';
import styles from './Auth.module.css';

/**
 * Recuperar la contraseña, en dos pasos: pedir el código y usarlo.
 *
 * La aclaración sobre qué cuentas alcanza está desde el principio y no después
 * de intentarlo, por dos razones. Una, que así nadie espera un correo que no va
 * a llegar. La otra, que si el aviso dependiera de la respuesta estaríamos
 * contando si ese correo tiene cuenta o no.
 */
export default function Recuperar() {
  const navigate = useNavigate();
  const { paso, error, aviso, enviando, pedirCodigo, restablecer, volverAlCorreo } =
    useRecuperacion({ alCompletar: () => navigate('/reservas') });

  const [email, setEmail] = useState('');
  const [errorCampo, setErrorCampo] = useState(null);

  const avisos = (
    <>
      {error ? <Toast tipo="error" mensaje={error} /> : null}
      {aviso ? <Toast tipo="exito" mensaje={aviso} /> : null}
    </>
  );

  if (paso === 'codigo') {
    return (
      <PasoNuevaContrasena
        avisos={avisos}
        cargando={enviando}
        onGuardar={restablecer}
        onOtroCorreo={volverAlCorreo}
      />
    );
  }

  const handleSubmit = async (evento) => {
    evento.preventDefault();

    const limpio = email.trim();
    if (!limpio || !limpio.includes('@')) {
      setErrorCampo('Ingrese un correo electrónico válido.');
      return;
    }

    setErrorCampo(null);
    await pedirCodigo(limpio);
  };

  return (
    <main className={styles.contenedor}>
      <div className={styles.panel}>
        <header className={styles.cabecera}>
          <h1 className={styles.titulo}>{TEXTOS.recuperacion.titulo}</h1>
          <p className={styles.subtitulo}>{TEXTOS.recuperacion.subtitulo}</p>
        </header>

        {avisos}

        <p className={styles.aclaracion}>{TEXTOS.recuperacion.aclaracionCuentas}</p>

        <form onSubmit={handleSubmit} className={styles.formulario} noValidate>
          <Field id="email" etiqueta={TEXTOS.recuperacion.correo} error={errorCampo} obligatorio>
            <Input
              type="email"
              name="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              autoComplete="email"
            />
          </Field>

          <Button type="submit" variante="primario" bloque cargando={enviando}>
            {TEXTOS.recuperacion.enviarCodigo}
          </Button>
        </form>

        <div className={styles.pie}>
          <Link to="/login" className={styles.enlace}>
            {TEXTOS.recuperacion.volverAlIngreso}
          </Link>
        </div>
      </div>
    </main>
  );
}
