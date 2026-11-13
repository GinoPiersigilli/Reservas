import { cloneElement, isValidElement, useId } from 'react';
import styles from './Field.module.css';

/**
 * Une las propiedades que ya trae el control con las que aporta el campo, sin
 * pisar lo que el control declare explícitamente.
 */
const propsDelHijo = (hijo, propsControl, tieneError) => {
  const propias = hijo.props;
  const descripciones = [propias['aria-describedby'], propsControl['aria-describedby']]
    .filter(Boolean)
    .join(' ');

  const resultado = {
    id: propias.id || propsControl.id,
    'aria-describedby': descripciones || undefined,
    'aria-invalid': propias['aria-invalid'] ?? propsControl['aria-invalid'],
    required: propias.required ?? propsControl.required
  };

  // Los controles propios reciben además el estado de error como propiedad;
  // a un elemento nativo solo se le pasan los aria-*.
  if (typeof hijo.type !== 'string') {
    resultado.conError = propias.conError ?? tieneError;
  }

  return resultado;
};

/**
 * Etiqueta, texto de ayuda y mensaje de error de un campo, con los `aria-*`
 * que los relacionan con el control. Acepta el control como hijo (al que le
 * inyecta esas propiedades) o como función que las recibe.
 */
export default function Field({
  id,
  etiqueta,
  ayuda,
  error,
  obligatorio = false,
  className = '',
  children
}) {
  const autoId = useId();
  const controlId = id || `campo-${autoId}`;

  const idAyuda = ayuda ? `${controlId}-ayuda` : undefined;
  const idError = error ? `${controlId}-error` : undefined;
  const ariaDescribedBy = [idAyuda, idError].filter(Boolean).join(' ') || undefined;
  const tieneError = Boolean(error);

  const propsControl = {
    id: controlId,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': tieneError || undefined,
    required: obligatorio || undefined
  };

  const renderContenido = () => {
    if (typeof children === 'function') {
      return children({ ...propsControl, conError: tieneError });
    }
    if (isValidElement(children)) {
      return cloneElement(children, propsDelHijo(children, propsControl, tieneError));
    }
    return children;
  };

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {etiqueta ? (
        <label htmlFor={controlId} className={styles.label}>
          <span>{etiqueta}</span>
          {obligatorio ? (
            <span className={styles.obligatorio} aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {renderContenido()}

      {ayuda ? (
        <p id={idAyuda} className={styles.ayuda}>
          {ayuda}
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
