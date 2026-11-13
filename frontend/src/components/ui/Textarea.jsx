import { forwardRef } from 'react';
import styles from './Textarea.module.css';

const Textarea = forwardRef(function Textarea(
  { rows = 3, conError = false, className = '', ...rest },
  ref
) {
  const esInvalido = Boolean(conError || rest['aria-invalid']);
  const clases = [styles.textarea, esInvalido ? styles.invalido : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <textarea
      ref={ref}
      rows={rows}
      className={clases}
      aria-invalid={esInvalido || undefined}
      {...rest}
    />
  );
});

export default Textarea;
