import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Field, Input } from '../../components/ui/index.js';
import { TEXTOS } from '../../textos.js';
import styles from '../Auth.module.css';

/** Las mismas reglas que pide el alta, para no aceptar acá lo que allá se rechaza. */
const validar = ({ codigo, contrasena, repetida }) => {
  const errores = {};
  if (!codigo.trim()) errores.codigo = 'Ingrese el código que recibió.';
  if (contrasena.length < 6) errores.contrasena = 'La contraseña debe tener al menos 6 caracteres.';
  if (contrasena !== repetida) errores.repetida = 'Las contraseñas no coinciden.';
  return errores;
};

/**
 * Segundo paso: el código del correo y la contraseña nueva, juntos.
 *
 * Van en la misma pantalla porque son un solo trámite: el código no sirve para
 * nada por sí solo y pedirlo aparte agregaría un paso sin agregar nada.
 */
export default function PasoNuevaContrasena({ avisos, cargando, onGuardar, onOtroCorreo }) {
  const [campos, setCampos] = useState({ codigo: '', contrasena: '', repetida: '' });
  const [errores, setErrores] = useState({});

  const cambiar = (nombre) => (evento) => {
    setCampos((previo) => ({ ...previo, [nombre]: evento.target.value }));
    if (errores[nombre]) setErrores((previo) => ({ ...previo, [nombre]: undefined }));
  };

  const handleSubmit = async (evento) => {
    evento.preventDefault();

    const nuevos = validar(campos);
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    await onGuardar({ codigo: campos.codigo.trim(), contrasena: campos.contrasena });
  };

  return (
    <main className={styles.contenedor}>
      <div className={styles.panel}>
        <header className={styles.cabecera}>
          <h1 className={styles.titulo}>{TEXTOS.recuperacion.tituloPaso2}</h1>
          <p className={styles.subtitulo}>{TEXTOS.recuperacion.subtituloPaso2}</p>
        </header>

        {avisos}

        <form onSubmit={handleSubmit} className={styles.formulario} noValidate>
          <Field
            id="codigo"
            etiqueta={TEXTOS.recuperacion.codigo}
            error={errores.codigo}
            obligatorio
          >
            <Input
              type="text"
              name="codigo"
              value={campos.codigo}
              onChange={cambiar('codigo')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
          </Field>

          <Field
            id="contrasena"
            etiqueta={TEXTOS.recuperacion.nuevaContrasena}
            error={errores.contrasena}
            obligatorio
          >
            <Input
              type="password"
              name="contrasena"
              value={campos.contrasena}
              onChange={cambiar('contrasena')}
              autoComplete="new-password"
            />
          </Field>

          <Field
            id="repetida"
            etiqueta={TEXTOS.recuperacion.confirmarContrasena}
            error={errores.repetida}
            obligatorio
          >
            <Input
              type="password"
              name="repetida"
              value={campos.repetida}
              onChange={cambiar('repetida')}
              autoComplete="new-password"
            />
          </Field>

          <Button type="submit" variante="primario" bloque cargando={cargando}>
            {TEXTOS.recuperacion.guardar}
          </Button>
        </form>

        <div className={styles.pie}>
          <Button type="button" variante="secundario" bloque onClick={onOtroCorreo}>
            {TEXTOS.recuperacion.usarOtroCorreo}
          </Button>

          <Link to="/login" className={styles.enlace}>
            {TEXTOS.recuperacion.volverAlIngreso}
          </Link>
        </div>
      </div>
    </main>
  );
}
