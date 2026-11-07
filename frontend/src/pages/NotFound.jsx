import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import { TEXTOS } from '../textos.js';
import styles from './NotFound.module.css';

const NotFound = () => {
  const auth = useAuth();
  const tieneSesion = Boolean(auth?.usuario);

  const ficha = (
    <section className={styles.panel} aria-labelledby="titulo-no-encontrado">
      <p className={styles.codigo}>Error 404</p>
      <h1 id="titulo-no-encontrado" className={styles.titulo}>
        {TEXTOS.noEncontrado.titulo}
      </h1>
      <p className={styles.descripcion}>{TEXTOS.noEncontrado.descripcion}</p>
      <div className={styles.acciones}>
        <Link to="/reservas" className={styles.enlace}>
          {TEXTOS.noEncontrado.volver}
        </Link>
      </div>
    </section>
  );

  if (tieneSesion) {
    return <AppShell>{ficha}</AppShell>;
  }

  return <main className={styles.contenedorExterno}>{ficha}</main>;
};

export default NotFound;
