import { isValidElement } from 'react';
import { Inbox } from 'lucide-react';
import { TEXTOS } from '../../textos.js';
import styles from './EmptyState.module.css';

export default function EmptyState({
  titulo,
  title,
  descripcion,
  description,
  icono: IconoProp,
  icon,
  accion,
  action,
  className = '',
  ...rest
}) {
  const textoTitulo = titulo || title || TEXTOS.ui.tablaVaciaTitulo;
  const textoDescripcion = descripcion || description || TEXTOS.ui.tablaVaciaDescripcion;
  const Icono = IconoProp || icon || Inbox;
  const nodoAccion = accion || action;

  const renderIcono = () => {
    if (isValidElement(Icono)) return Icono;
    const ComponenteIcono = Icono;
    return <ComponenteIcono size={24} strokeWidth={1.75} />;
  };

  return (
    <div
      className={[styles.contenedor, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <span className={styles.icono} aria-hidden="true">
        {renderIcono()}
      </span>
      <h3 className={styles.titulo}>{textoTitulo}</h3>
      {textoDescripcion ? (
        <p className={styles.descripcion}>{textoDescripcion}</p>
      ) : null}
      {nodoAccion ? <div className={styles.accion}>{nodoAccion}</div> : null}
    </div>
  );
}

