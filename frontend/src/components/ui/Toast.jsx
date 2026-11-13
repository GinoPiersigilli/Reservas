import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, Info, X } from 'lucide-react';
import { TEXTOS } from '../../textos.js';
import styles from './Toast.module.css';

const CONFIG_TIPOS = {
  exito: { clase: styles.exito, Icono: CheckCircle2, rol: 'status', live: 'polite' },
  error: { clase: styles.error, Icono: AlertCircle, rol: 'alert', live: 'assertive' },
  advertencia: { clase: styles.advertencia, Icono: Clock, rol: 'status', live: 'polite' },
  info: { clase: styles.info, Icono: Info, rol: 'status', live: 'polite' }
};

/**
 * Notificación breve. Un error se anuncia con `role="alert"` y
 * `aria-live="assertive"` para que los lectores de pantalla lo interrumpan
 * todo; el resto se anuncia de forma cortés.
 */
export default function Toast({
  tipo = 'info',
  titulo,
  mensaje,
  visible = true,
  duracion,
  onCerrar,
  className = '',
  children,
  ...rest
}) {
  const { clase, Icono, rol, live } = CONFIG_TIPOS[tipo] || CONFIG_TIPOS.info;
  const contenido = mensaje || children;

  useEffect(() => {
    if (!visible || !duracion || !onCerrar) return undefined;
    const timer = setTimeout(onCerrar, duracion);
    return () => clearTimeout(timer);
  }, [visible, duracion, onCerrar]);

  if (!visible) return null;

  return (
    <div
      role={rol}
      aria-live={live}
      className={[styles.toast, clase, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <div className={styles.cuerpo}>
        <span className={styles.icono} aria-hidden="true">
          <Icono size={16} strokeWidth={1.75} />
        </span>
        <div className={styles.textos}>
          {titulo ? <strong className={styles.titulo}>{titulo}</strong> : null}
          {contenido ? <span className={styles.mensaje}>{contenido}</span> : null}
        </div>
      </div>

      {onCerrar ? (
        <button
          type="button"
          className={styles.cerrar}
          aria-label={TEXTOS.ui.cerrarNotificacion}
          onClick={() => onCerrar()}
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
