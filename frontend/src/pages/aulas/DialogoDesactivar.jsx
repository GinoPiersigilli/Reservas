import { ConfirmDialog, Field, Textarea } from '../../components/ui/index.js';
import { TEXTOS } from '../../textos.js';
import styles from '../Aulas.module.css';

/**
 * Baja de un aula.
 *
 * Si el aula tiene reservas futuras, el backend rechaza la baja con un 409 y la
 * cantidad afectada; entonces se muestra el aviso y se exige un motivo para
 * cancelarlas, que queda registrado en el historial de cada reserva.
 */
export default function DialogoDesactivar({
  abierto,
  cancelarReservasFuturas,
  motivo,
  error,
  avisoAfectadas,
  desactivando,
  onCambiarCancelar,
  onCambiarMotivo,
  onCancelar,
  onConfirmar
}) {
  return (
    <ConfirmDialog
      abierto={abierto}
      titulo={TEXTOS.aulas.confirmarDesactivarTitulo}
      descripcion={TEXTOS.aulas.confirmarDesactivarDescripcion}
      textoConfirmar={TEXTOS.aulas.desactivar}
      textoCancelar={TEXTOS.acciones.cancelar}
      variante="peligro"
      cargando={desactivando}
      onCancelar={onCancelar}
      onConfirmar={onConfirmar}
    >
      {avisoAfectadas ? (
        <div role="alert" className={styles.alertaAfectadas}>
          {avisoAfectadas}
        </div>
      ) : null}

      <label className={styles.checkboxWrapper}>
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={cancelarReservasFuturas}
          onChange={(e) => onCambiarCancelar(e.target.checked)}
        />
        <span>{TEXTOS.aulas.cancelarReservasFuturas}</span>
      </label>

      {cancelarReservasFuturas ? (
        <Field etiqueta={TEXTOS.aulas.motivoBaja} obligatorio error={error}>
          <Textarea
            rows={3}
            value={motivo}
            onChange={(e) => onCambiarMotivo(e.target.value)}
            placeholder="Ingrese el motivo de la baja del aula..."
            autoFocus
          />
        </Field>
      ) : error ? (
        <div role="alert" className={styles.errorModal}>
          {error}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
