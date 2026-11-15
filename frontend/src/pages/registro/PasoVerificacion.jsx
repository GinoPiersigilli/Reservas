import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Field, Input } from '../../components/ui/index.js';
import { TEXTOS } from '../../textos.js';
import styles from '../Auth.module.css';

/**
 * Segundo paso del alta: el código que Clerk envía al correo.
 *
 * Antes esta pantalla no tenía salida, con el argumento de que la cuenta ya
 * existe en Clerk y lo único que falta es probar la dirección. El argumento era
 * cierto y la conclusión estaba mal: quien escribía mal su correo quedaba
 * encerrado, sin poder corregirlo ni volver atrás, y la única vía era editar la
 * barra de direcciones.
 *
 * Ahora hay dos salidas, porque sirven para cosas distintas. «Usar otro correo»
 * es para el que se equivocó al escribirlo: descarta el alta en curso y vuelve
 * al formulario. «Volver al ingreso» es para el que ya tenía cuenta o prefiere
 * seguir después: el alta queda sin verificar y se retoma cuando quiera.
 */
export default function PasoVerificacion({
  avisos,
  cargando,
  onVerificar,
  onReenviar,
  onOtroCorreo
}) {
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

          <Button type="button" variante="secundario" bloque onClick={onOtroCorreo}>
            {TEXTOS.registro.usarOtroCorreo}
          </Button>

          <Link to="/login" className={styles.enlace}>
            {TEXTOS.registro.volverAlIngreso}
          </Link>
        </div>
      </div>
    </main>
  );
}
