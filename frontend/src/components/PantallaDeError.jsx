import styles from './PantallaDeError.module.css';

/**
 * Pantalla completa para cuando la aplicación no puede seguir.
 *
 * `ErrorState` cubre el error de una sección —una tabla que no cargó— dentro de
 * una página que sigue siendo navegable. Esto es lo otro: no hay página, no hay
 * barra lateral y no hay a dónde ir, así que la pantalla tiene que traer su
 * propia salida. Por eso `acciones` no es opcional en la práctica: quien la use
 * sin pasar ninguna deja a la persona encerrada, que es justo lo que este
 * componente existe para evitar.
 *
 * `detalle` es el texto técnico —el nombre de una variable, un mensaje de
 * excepción—. Va aparte del cuerpo porque le sirve a quien instala el proyecto,
 * no a quien lo usa.
 */
export default function PantallaDeError({ titulo, descripcion, detalle, acciones }) {
  return (
    <main className={styles.contenedor}>
      <section className={styles.panel} role="alert" aria-labelledby="pantalla-error-titulo">
        <h1 id="pantalla-error-titulo" className={styles.titulo}>
          {titulo}
        </h1>

        {descripcion ? <p className={styles.descripcion}>{descripcion}</p> : null}

        {detalle ? <p className={styles.detalle}>{detalle}</p> : null}

        {acciones ? <div className={styles.acciones}>{acciones}</div> : null}
      </section>
    </main>
  );
}
