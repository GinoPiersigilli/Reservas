import { AlertCircle, RotateCw } from 'lucide-react';
import { TEXTOS } from '../../textos.js';
import Button from './Button.jsx';
import styles from './ErrorState.module.css';

export default function ErrorState({
  titulo,
  descripcion,
  onReintentar,
  textoReintentar = TEXTOS.acciones.reintentar,
  mostrarReintentar = true,
  className = '',
  ...rest
}) {
  const textoTitulo = titulo || TEXTOS.ui.errorTitulo;
  const textoDescripcion = descripcion || TEXTOS.ui.errorDescripcion;

  return (
    <div
      role="alert"
      className={[styles.contenedor, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <span className={styles.icono} aria-hidden="true">
        <AlertCircle size={24} strokeWidth={1.75} />
      </span>
      <h3 className={styles.titulo}>{textoTitulo}</h3>
      {textoDescripcion ? <p className={styles.descripcion}>{textoDescripcion}</p> : null}
      {mostrarReintentar ? (
        <div className={styles.acciones}>
          <Button variante="secundario" icono={RotateCw} onClick={() => onReintentar?.()}>
            {textoReintentar}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
