import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, Info, X } from 'lucide-react';
import { TEXTOS } from '../../textos.js';
import styles from './Toast.module.css';

const CONFIG_TIPOS = {
  exito: { clase: styles.exito, Icono: CheckCircle2, rol: 'status', live: 'polite' },
  success: { clase: styles.exito, Icono: CheckCircle2, rol: 'status', live: 'polite' },
  error: { clase: styles.error, Icono: AlertCircle, rol: 'alert', live: 'assertive' },
  advertencia: { clase: styles.advertencia, Icono: Clock, rol: 'status', live: 'polite' },
  warning: { clase: styles.advertencia, Icono: Clock, rol: 'status', live: 'polite' },
  info: { clase: styles.info, Icono: Info, rol: 'status', live: 'polite' }
};

export default function Toast({
  tipo = 'info',
  type,
  titulo,
  title,
  mensaje,
  message,
  visible = true,
  open = true,
  duracion,
  duration,
  onCerrar,
  onClose,
  className = '',
  children,
  ...rest
}) {
  const estaVisible = Boolean(visible && open);
  const claveTipo = String(type || tipo || 'info').toLowerCase();
  const config = CONFIG_TIPOS[claveTipo] || CONFIG_TIPOS.info;
  const { clase, Icono, rol, live } = config;

  const textoTitulo = titulo || title;
  const textoMensaje = mensaje || message || children;
  const manejadorCerrar = onCerrar || onClose;
  const tiempoAutoCierre = duration ?? duracion;

  useEffect(() => {
    if (!estaVisible || !tiempoAutoCierre || !manejadorCerrar) return undefined;
    const timer = setTimeout(() => {
      manejadorCerrar();
    }, tiempoAutoCierre);
    return () => clearTimeout(timer);
  }, [estaVisible, tiempoAutoCierre, manejadorCerrar]);

  if (!estaVisible) return null;

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
          {textoTitulo ? <strong className={styles.titulo}>{textoTitulo}</strong> : null}
          {textoMensaje ? <span className={styles.mensaje}>{textoMensaje}</span> : null}
        </div>
      </div>

      {manejadorCerrar ? (
        <button
          type="button"
          className={styles.cerrar}
          aria-label={TEXTOS.ui.cerrarNotificacion}
          onClick={() => manejadorCerrar()}
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
