import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

const Select = forwardRef(function Select(
  { opciones, placeholder, conError = false, className = '', children, ...rest },
  ref
) {
  const esInvalido = Boolean(conError || rest['aria-invalid']);
  const clases = [styles.select, esInvalido ? styles.invalido : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.contenedor}>
      <select ref={ref} className={clases} aria-invalid={esInvalido || undefined} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {Array.isArray(opciones)
          ? opciones.map((op) => {
              // Una opción puede ser un valor suelto o { value, label, disabled }.
              const valor = typeof op === 'object' ? op.value : op;
              const etiqueta = typeof op === 'object' ? op.label : op;
              return (
                <option key={String(valor)} value={valor} disabled={Boolean(op?.disabled)}>
                  {etiqueta}
                </option>
              );
            })
          : children}
      </select>
      <span className={styles.icono} aria-hidden="true">
        <ChevronDown size={16} strokeWidth={1.75} />
      </span>
    </div>
  );
});

export default Select;
