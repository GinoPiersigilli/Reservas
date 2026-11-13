import { Field, Input, Select } from '../../components/ui/index.js';
import { HORA_FIN_JORNADA, HORA_INICIO_JORNADA } from '../../config/horarios.js';
import { TEXTOS } from '../../textos.js';
import styles from '../FormularioReserva.module.css';

/** Fecha, aula y cantidad de personas: lo que define qué franjas sirven. */
export function CamposPrincipales({
  form,
  aulas,
  aulaSeleccionada,
  aulaCargando,
  errores,
  onChange
}) {
  const ayudaAula = aulaSeleccionada
    ? `${aulaSeleccionada.ubicacion ? `${aulaSeleccionada.ubicacion} · ` : ''}Capacidad: ${aulaSeleccionada.capacidad} personas.`
    : 'Elija un aula para consultar ubicación y capacidad.';

  return (
    <section className={styles.panelSeccion}>
      <div className={styles.grillaCampos}>
        <Field id="fecha" etiqueta={TEXTOS.formulario.fecha} error={errores.fecha} obligatorio>
          <Input type="date" name="fecha" value={form.fecha} onChange={onChange} />
        </Field>

        <Field
          id="aulaId"
          etiqueta={TEXTOS.formulario.aula}
          ayuda={ayudaAula}
          error={errores.aulaId}
          obligatorio
        >
          <Select name="aulaId" value={form.aulaId} onChange={onChange} disabled={aulaCargando}>
            <option value="">{aulaCargando ? 'Cargando aulas…' : 'Elija un aula'}</option>
            {aulas.map((aula) => (
              <option key={aula.id} value={aula.id}>
                {aula.nombre}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="cantidadPersonas"
          etiqueta={TEXTOS.formulario.cantidadPersonas}
          ayuda={
            aulaSeleccionada
              ? `Capacidad máxima: ${aulaSeleccionada.capacidad} personas.`
              : undefined
          }
          error={errores.cantidadPersonas}
          obligatorio
        >
          <Input
            type="number"
            name="cantidadPersonas"
            min="1"
            value={form.cantidadPersonas}
            onChange={onChange}
          />
        </Field>
      </div>
    </section>
  );
}

/** Horario y motivo: se completan solos al elegir una franja en la grilla. */
export function CamposHorario({ form, errores, onChange }) {
  return (
    <>
      <div className={styles.grillaHoras}>
        <Field
          id="horaInicio"
          etiqueta={TEXTOS.formulario.horaInicio}
          ayuda={`Desde las ${HORA_INICIO_JORNADA}.`}
          error={errores.horaInicio}
          obligatorio
        >
          <Input
            type="time"
            name="horaInicio"
            min={HORA_INICIO_JORNADA}
            max={HORA_FIN_JORNADA}
            value={form.horaInicio}
            onChange={onChange}
          />
        </Field>

        <Field
          id="horaFin"
          etiqueta={TEXTOS.formulario.horaFin}
          ayuda={`Hasta las ${HORA_FIN_JORNADA}.`}
          error={errores.horaFin}
          obligatorio
        >
          <Input
            type="time"
            name="horaFin"
            min={HORA_INICIO_JORNADA}
            max={HORA_FIN_JORNADA}
            value={form.horaFin}
            onChange={onChange}
          />
        </Field>
      </div>

      <Field
        id="motivo"
        etiqueta={TEXTOS.formulario.motivo}
        ayuda="Indique cátedra, examen o reunión académica (máximo 255 caracteres)."
        error={errores.motivo}
        obligatorio
      >
        <Input
          type="text"
          name="motivo"
          maxLength={255}
          placeholder="Ej: Parcial de Física II"
          value={form.motivo}
          onChange={onChange}
        />
      </Field>
    </>
  );
}
