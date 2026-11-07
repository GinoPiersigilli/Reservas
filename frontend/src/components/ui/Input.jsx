import { forwardRef } from 'react';
import styles from './Input.module.css';

const Input = forwardRef(function Input(
  { type = 'text', hasError = false, error = false, className = '', ...rest },
  ref
) {
  const esInvalido = Boolean(hasError || error || rest['aria-invalid']);
  const clases = [styles.input, esInvalido ? styles.invalido : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <input
      ref={ref}
      type={type}
      className={clases}
      aria-invalid={esInvalido || undefined}
      {...rest}
    />
  );
});

export default Input;

