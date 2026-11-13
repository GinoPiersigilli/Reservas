import { isValidElement } from 'react';
import { Inbox } from 'lucide-react';
import { TEXTOS } from '../../textos.js';
import styles from './EmptyState.module.css';

export default function EmptyState({
  titulo,
  descripcion,
  icono: IconoProp,
  accion,
  className = '',
  ...rest
}) {
  const textoTitulo = titulo || TEXTOS.ui.tablaVaciaTitulo;
  const textoDescripcion = descripcion || TEXTOS.ui.tablaVaciaDescripcion;
  const Icono = IconoProp || Inbox;

  const renderIcono = () => {
    if (isValidElement(Icono)) return Icono;
    const ComponenteIcono = Icono;
    return <ComponenteIcono size={24} strokeWidth={1.75} />;
  };

  return (
    <div className={[styles.contenedor, className].filter(Boolean).join(' ')} {...rest}>
      <span className={styles.icono} aria-hidden="true">
        {renderIcono()}
      </span>
      <h3 className={styles.titulo}>{textoTitulo}</h3>
      {textoDescripcion ? <p className={styles.descripcion}>{textoDescripcion}</p> : null}
      {accion ? <div className={styles.accion}>{accion}</div> : null}
    </div>
  );
}
