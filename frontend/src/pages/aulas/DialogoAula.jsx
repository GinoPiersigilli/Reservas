import { ConfirmDialog, Field, Input } from '../../components/ui/index.js';
import { TEXTOS } from '../../textos.js';
import styles from '../Aulas.module.css';

/** Alta y edición de un aula: los mismos campos para los dos casos. */
export default function DialogoAula({
  abierto,
  modo,
  formData,
  errores,
  errorGeneral,
  guardando,
  onCambiarCampo,
  onCancelar,
  onConfirmar
}) {
  const campo = (nombre) => (e) => onCambiarCampo(nombre, e.target.value);

  return (
    <ConfirmDialog
      abierto={abierto}
      titulo={modo === 'crear' ? TEXTOS.aulas.nuevaAula : TEXTOS.aulas.editarAula}
      textoConfirmar={TEXTOS.acciones.guardarCambios}
      textoCancelar={TEXTOS.acciones.cancelar}
      variante="primario"
      cargando={guardando}
      onCancelar={onCancelar}
      onConfirmar={onConfirmar}
    >
      <div className={styles.formModal}>
        {errorGeneral ? (
          <div role="alert" className={styles.errorModal}>
            {errorGeneral}
          </div>
        ) : null}

        <Field etiqueta={TEXTOS.aulas.nombre} obligatorio error={errores.nombre}>
          <Input
            name="nombre"
            value={formData.nombre}
            onChange={campo('nombre')}
            placeholder="Ej. Aula 101 Magna"
            autoFocus
          />
        </Field>

        <Field etiqueta={TEXTOS.aulas.ubicacion} obligatorio error={errores.ubicacion}>
          <Input
            name="ubicacion"
            value={formData.ubicacion}
            onChange={campo('ubicacion')}
            placeholder="Ej. Pabellón Central - Piso 1"
          />
        </Field>

        <Field etiqueta={TEXTOS.aulas.capacidad} obligatorio error={errores.capacidad}>
          <Input
            type="number"
            min="1"
            max="1000"
            name="capacidad"
            value={formData.capacidad}
            onChange={campo('capacidad')}
            placeholder="Ej. 45"
          />
        </Field>

        <Field
          etiqueta={TEXTOS.aulas.recursos}
          ayuda="Separados por coma (ej. proyector, pizarra, 30 PCs)"
        >
          <Input
            name="recursos"
            value={formData.recursos}
            onChange={campo('recursos')}
            placeholder="Ej. proyector, pizarra, aire acondicionado"
          />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
