import { useEffect, useId, useRef } from 'react';
import { TEXTOS } from '../../textos.js';
import Button from './Button.jsx';
import styles from './ConfirmDialog.module.css';

const SELECTOR_ENFOCABLES =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export default function ConfirmDialog({
  abierto = false,
  open = false,
  titulo,
  title,
  descripcion,
  description,
  textoConfirmar = TEXTOS.acciones.confirmar,
  confirmText,
  textoCancelar = TEXTOS.acciones.cancelar,
  cancelText,
  variante = 'peligro',
  variant,
  cargando = false,
  loading = false,
  onConfirmar,
  onConfirm,
  onCancelar,
  onCancel,
  onClose,
  children
}) {
  const estaAbierto = Boolean(abierto || open);
  const estaCargando = Boolean(cargando || loading);
  const textoTitulo = titulo || title;
  const textoDescripcion = descripcion || description;
  const etiquetaConfirmar = confirmText || textoConfirmar;
  const etiquetaCancelar = cancelText || textoCancelar;
  const varianteBoton = variant || variante;
  const manejadorConfirmar = onConfirmar || onConfirm;
  const manejadorCancelar = onCancelar || onCancel || onClose;

  const baseId = useId();
  const idTitulo = `dialogo-titulo-${baseId}`;
  const idDescripcion = `dialogo-desc-${baseId}`;

  const dialogoRef = useRef(null);
  const botonCancelarRef = useRef(null);
  const focoPrevioRef = useRef(null);

  useEffect(() => {
    if (!estaAbierto) return undefined;

    focoPrevioRef.current = document.activeElement;

    const enfocarInicial = () => {
      if (botonCancelarRef.current && !botonCancelarRef.current.disabled) {
        botonCancelarRef.current.focus();
        return;
      }
      const elementos = dialogoRef.current?.querySelectorAll(SELECTOR_ENFOCABLES);
      if (elementos && elementos.length > 0) {
        elementos[0].focus();
      } else {
        dialogoRef.current?.focus();
      }
    };

    enfocarInicial();

    const manejarKeyDown = (evento) => {
      if (evento.key === 'Escape') {
        if (!estaCargando) {
          evento.preventDefault();
          evento.stopPropagation();
          manejadorCancelar?.();
        }
        return;
      }

      if (evento.key === 'Tab' && dialogoRef.current) {
        const enfocables = Array.from(
          dialogoRef.current.querySelectorAll(SELECTOR_ENFOCABLES)
        );
        if (enfocables.length === 0) {
          evento.preventDefault();
          return;
        }
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];

        if (evento.shiftKey) {
          if (
            document.activeElement === primero ||
            !dialogoRef.current.contains(document.activeElement)
          ) {
            evento.preventDefault();
            ultimo.focus();
          }
        } else if (
          document.activeElement === ultimo ||
          !dialogoRef.current.contains(document.activeElement)
        ) {
          evento.preventDefault();
          primero.focus();
        }
      }
    };

    document.addEventListener('keydown', manejarKeyDown);

    return () => {
      document.removeEventListener('keydown', manejarKeyDown);
      if (
        focoPrevioRef.current &&
        typeof focoPrevioRef.current.focus === 'function'
      ) {
        focoPrevioRef.current.focus();
      }
    };
  }, [estaAbierto, estaCargando, manejadorCancelar]);

  if (!estaAbierto) return null;

  return (
    <div
      className={styles.telon}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !estaCargando) {
          manejadorCancelar?.();
        }
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={textoTitulo ? idTitulo : undefined}
        aria-describedby={textoDescripcion ? idDescripcion : undefined}
        tabIndex={-1}
        className={styles.dialogo}
      >
        {textoTitulo ? (
          <div className={styles.cabecera}>
            <h2 id={idTitulo} className={styles.titulo}>
              {textoTitulo}
            </h2>
          </div>
        ) : null}

        {textoDescripcion ? (
          <p id={idDescripcion} className={styles.descripcion}>
            {textoDescripcion}
          </p>
        ) : null}

        {children}

        <div className={styles.pie}>
          <Button
            ref={botonCancelarRef}
            variante="secundario"
            disabled={estaCargando}
            onClick={() => manejadorCancelar?.()}
          >
            {etiquetaCancelar}
          </Button>
          <Button
            variante={varianteBoton}
            cargando={estaCargando}
            onClick={() => manejadorConfirmar?.()}
          >
            {etiquetaConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}

