import { useId, useRef } from 'react';
import { TEXTOS } from '../../textos.js';
import { useTrampaDeFoco } from '../../hooks/useTrampaDeFoco.js';
import Button from './Button.jsx';
import styles from './ConfirmDialog.module.css';

/**
 * Diálogo de confirmación modal.
 *
 * El manejo de foco y teclado vive en `useTrampaDeFoco`, así este componente
 * solo describe lo que se ve. Mientras `cargando` es true no se puede cerrar,
 * para no abandonar una operación a mitad de camino.
 */
export default function ConfirmDialog({
  abierto = false,
  titulo,
  descripcion,
  textoConfirmar = TEXTOS.acciones.confirmar,
  textoCancelar = TEXTOS.acciones.cancelar,
  variante = 'peligro',
  cargando = false,
  onConfirmar,
  onCancelar,
  children
}) {
  const baseId = useId();
  const idTitulo = `dialogo-titulo-${baseId}`;
  const idDescripcion = `dialogo-desc-${baseId}`;

  const dialogoRef = useRef(null);
  const botonCancelarRef = useRef(null);

  useTrampaDeFoco({
    activo: abierto,
    contenedorRef: dialogoRef,
    inicialRef: botonCancelarRef,
    alEscapar: onCancelar,
    bloqueado: cargando
  });

  if (!abierto) return null;

  const cerrarDesdeTelon = (evento) => {
    if (evento.target === evento.currentTarget && !cargando) onCancelar?.();
  };

  return (
    <div className={styles.telon} onMouseDown={cerrarDesdeTelon}>
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? idTitulo : undefined}
        aria-describedby={descripcion ? idDescripcion : undefined}
        tabIndex={-1}
        className={styles.dialogo}
      >
        {titulo ? (
          <div className={styles.cabecera}>
            <h2 id={idTitulo} className={styles.titulo}>
              {titulo}
            </h2>
          </div>
        ) : null}

        {descripcion ? (
          <p id={idDescripcion} className={styles.descripcion}>
            {descripcion}
          </p>
        ) : null}

        {children}

        <div className={styles.pie}>
          <Button
            ref={botonCancelarRef}
            variante="secundario"
            disabled={cargando}
            onClick={() => onCancelar?.()}
          >
            {textoCancelar}
          </Button>
          <Button variante={variante} cargando={cargando} onClick={() => onConfirmar?.()}>
            {textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
