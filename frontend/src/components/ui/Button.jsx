import { forwardRef, isValidElement } from 'react';
import { Loader2 } from 'lucide-react';
import styles from './Button.module.css';

const VARIANTES = {
  primario: styles.primario,
  primary: styles.primario,
  secundario: styles.secundario,
  secondary: styles.secundario,
  peligro: styles.peligro,
  danger: styles.peligro
};

const Button = forwardRef(function Button(
  {
    variante,
    variant,
    tamano = 'md',
    size,
    bloque = false,
    fullWidth = false,
    cargando = false,
    loading = false,
    disabled = false,
    icono: IconoProp,
    icon,
    type = 'button',
    className = '',
    children,
    ...rest
  },
  ref
) {
  const varianteKey = variante || variant || 'primario';
  const claseVariante = VARIANTES[varianteKey] || styles.primario;
  const esSm = (tamano || size) === 'sm';
  const esBloque = bloque || fullWidth;
  const estaCargando = Boolean(cargando || loading);
  const estaDeshabilitado = Boolean(disabled || estaCargando);
  const Icono = IconoProp || icon;

  const clases = [
    styles.button,
    claseVariante,
    esSm ? styles.sm : '',
    esBloque ? styles.bloque : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  const renderIcono = () => {
    if (estaCargando) {
      return (
        <span className={styles.icono} aria-hidden="true">
          <Loader2 size={16} strokeWidth={1.75} className={styles.giro} />
        </span>
      );
    }
    if (!Icono) return null;
    if (isValidElement(Icono)) {
      return (
        <span className={styles.icono} aria-hidden="true">
          {Icono}
        </span>
      );
    }
    const ComponenteIcono = Icono;
    return (
      <span className={styles.icono} aria-hidden="true">
        <ComponenteIcono size={16} strokeWidth={1.75} />
      </span>
    );
  };

  return (
    <button
      ref={ref}
      type={type}
      className={clases}
      disabled={estaDeshabilitado}
      aria-busy={estaCargando || undefined}
      {...rest}
    >
      {renderIcono()}
      {children ? <span>{children}</span> : null}
    </button>
  );
});

export default Button;
