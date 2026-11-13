import { Link } from 'react-router-dom';
import { TEXTOS } from '../../textos.js';
import styles from '../DetalleReserva.module.css';

/** Ruta de navegación: listado de reservas y, si ya se cargó, su número. */
export default function MigasDetalle({ idReserva }) {
  return (
    <nav aria-label="Ruta de navegación" className={styles.migas}>
      <Link to="/reservas" className={styles.enlaceMiga}>
        {TEXTOS.reservas.migasRaiz}
      </Link>
      {idReserva ? (
        <>
          <span className={styles.separadorMiga} aria-hidden="true">
            /
          </span>
          <span className={styles.actualMiga} aria-current="page">
            #{idReserva}
          </span>
        </>
      ) : null}
    </nav>
  );
}
