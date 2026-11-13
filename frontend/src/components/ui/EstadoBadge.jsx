import { Ban, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { TEXTOS } from '../../textos.js';
import styles from './EstadoBadge.module.css';

const CONFIG_ESTADOS = {
  pendiente: {
    texto: TEXTOS.estados.pendiente,
    clase: styles.pendiente,
    Icono: Clock
  },
  aprobada: {
    texto: TEXTOS.estados.aprobada,
    clase: styles.aprobada,
    Icono: CheckCircle2
  },
  rechazada: {
    texto: TEXTOS.estados.rechazada,
    clase: styles.rechazada,
    Icono: XCircle
  },
  cancelada: {
    texto: TEXTOS.estados.cancelada,
    clase: styles.cancelada,
    Icono: Ban
  },
  activa: {
    texto: TEXTOS.estados.activa,
    clase: styles.aprobada,
    Icono: CheckCircle2
  },
  inactiva: {
    texto: TEXTOS.estados.inactiva,
    clase: styles.cancelada,
    Icono: Ban
  }
};

export default function EstadoBadge({ estado, className = '', ...rest }) {
  const clave = String(estado || 'pendiente').toLowerCase();
  const config = CONFIG_ESTADOS[clave] || CONFIG_ESTADOS.pendiente;
  const { texto, clase, Icono } = config;

  const clases = [styles.badge, clase, className].filter(Boolean).join(' ');

  return (
    <span className={clases} data-estado={clave} {...rest}>
      <span className={styles.icono} aria-hidden="true">
        <Icono size={16} strokeWidth={1.75} />
      </span>
      <span>{texto}</span>
    </span>
  );
}
