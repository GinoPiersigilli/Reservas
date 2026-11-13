import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

const Select = forwardRef(function Select(
  {
    opciones,
    options,
    placeholder,
    hasError = false,
    error = false,
    className = '',
    children,
    ...rest
  },
  ref
) {
  const esInvalido = Boolean(hasError || error || rest['aria-invalid']);
  const listaOpciones = opciones || options;
  const clases = [styles.select, esInvalido ? styles.invalido : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.contenedor}>
      <select ref={ref} className={clases} aria-invalid={esInvalido || undefined} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {Array.isArray(listaOpciones)
          ? listaOpciones.map((op) => {
              const valor = typeof op === 'object' ? (op.value ?? op.valor) : op;
              const etiqueta = typeof op === 'object' ? (op.label ?? op.etiqueta) : op;
              const deshabilitado = typeof op === 'object' ? Boolean(op.disabled) : false;
              return (
                <option key={String(valor)} value={valor} disabled={deshabilitado}>
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
