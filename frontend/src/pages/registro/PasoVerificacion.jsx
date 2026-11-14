import { useState } from 'react';
import { Button, Field, Input } from '../../components/ui/index.js';
import { TEXTOS } from '../../textos.js';
import styles from '../Auth.module.css';

/**
 * Segundo paso del alta: el código que Clerk envía al correo.
 *
 * No se vuelve atrás desde acá. La cuenta ya existe en Clerk; lo que falta es
 * probar que la dirección es de quien se registró, así que la salida es
 * confirmar el código o pedir uno nuevo.
 */
export default function PasoVerificacion({ avisos, cargando, onVerificar, onReenviar }) {
  const [codigo, setCodigo] = useState('');

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    await onVerificar(codigo.trim());
  };

  return (
    <main className={styles.contenedor}>
      <div className={styles.panel}>
        <header className={styles.cabecera}>
          <h1 className={styles.titulo}>{TEXTOS.registro.verificacionTitulo}</h1>
          <p className={styles.subtitulo}>{TEXTOS.registro.verificacionSubtitulo}</p>
        </header>

        {avisos}

        <form onSubmit={handleSubmit} className={styles.formulario} noValidate>
          <Field id="codigo" etiqueta={TEXTOS.registro.codigo} obligatorio>
            <Input
              type="text"
              name="codigo"
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
          </Field>

          <Button type="submit" variante="primario" bloque cargando={cargando}>
            {TEXTOS.registro.confirmar}
          </Button>
        </form>

        <div className={styles.pie}>
          <Button type="button" variante="secundario" bloque onClick={onReenviar}>
            {TEXTOS.registro.reenviar}
          </Button>
        </div>
      </div>
    </main>
  );
}
