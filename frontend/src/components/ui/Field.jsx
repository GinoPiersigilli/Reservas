import { cloneElement, isValidElement, useId } from 'react';
import styles from './Field.module.css';

export default function Field({
  id,
  etiqueta,
  label,
  ayuda,
  hint,
  error,
  obligatorio = false,
  required = false,
  className = '',
  children
}) {
  const autoId = useId();
  const controlId = id || `campo-${autoId}`;
  const textoEtiqueta = etiqueta || label;
  const textoAyuda = ayuda || hint;
  const esObligatorio = Boolean(obligatorio || required);

  const idAyuda = textoAyuda ? `${controlId}-ayuda` : undefined;
  const idError = error ? `${controlId}-error` : undefined;
  const ariaDescribedBy = [idAyuda, idError].filter(Boolean).join(' ') || undefined;
  const tieneError = Boolean(error);

  const propsControl = {
    id: controlId,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': tieneError || undefined,
    required: esObligatorio || undefined
  };

  let contenido = children;
  if (typeof children === 'function') {
    contenido = children({ ...propsControl, hasError: tieneError });
  } else if (isValidElement(children)) {
    const childProps = {
      id: children.props.id || controlId,
      'aria-describedby':
        [children.props['aria-describedby'], ariaDescribedBy].filter(Boolean).join(' ') ||
        undefined,
      'aria-invalid': children.props['aria-invalid'] ?? (tieneError || undefined),
      required: children.props.required ?? (esObligatorio || undefined)
    };
    if (typeof children.type !== 'string') {
      childProps.hasError = children.props.hasError ?? tieneError;
    }
    contenido = cloneElement(children, childProps);
  }

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {textoEtiqueta ? (
        <label htmlFor={controlId} className={styles.label}>
          <span>{textoEtiqueta}</span>
          {esObligatorio ? (
            <span className={styles.obligatorio} aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {contenido}

      {textoAyuda ? (
        <p id={idAyuda} className={styles.ayuda}>
          {textoAyuda}
        </p>
      ) : null}

      {error ? (
        <p id={idError} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
