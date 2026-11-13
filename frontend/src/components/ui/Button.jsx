import { forwardRef, isValidElement } from 'react';
import { Loader2 } from 'lucide-react';
import styles from './Button.module.css';

const VARIANTES = {
  primario: styles.primario,
  secundario: styles.secundario,
  peligro: styles.peligro
};

const clasesBoton = ({ variante, tamano, bloque, className }) =>
  [
    styles.button,
    VARIANTES[variante] || styles.primario,
    tamano === 'sm' ? styles.sm : '',
    bloque ? styles.bloque : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

const Button = forwardRef(function Button(
  {
    variante = 'primario',
    tamano = 'md',
    bloque = false,
    cargando = false,
    disabled = false,
    icono: Icono,
    type = 'button',
    className = '',
    children,
    ...rest
  },
  ref
) {
  const clases = clasesBoton({ variante, tamano, bloque, className });

  /** Acepta un componente de icono o un elemento ya construido. */
  const renderIcono = () => {
    if (cargando) {
      return (
        <span className={styles.icono} aria-hidden="true">
          <Loader2 size={16} strokeWidth={1.75} className={styles.giro} />
        </span>
      );
    }
    if (!Icono) return null;

    return (
      <span className={styles.icono} aria-hidden="true">
        {isValidElement(Icono) ? Icono : <Icono size={16} strokeWidth={1.75} />}
      </span>
    );
  };

  return (
    <button
      ref={ref}
      type={type}
      className={clases}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...rest}
    >
      {renderIcono()}
      {children ? <span>{children}</span> : null}
    </button>
  );
});

export default Button;
