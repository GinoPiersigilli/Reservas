import { Field, Input, Select, Textarea } from '../../components/ui/index.js';
import { OPCIONES_AULAS } from './datosDemo.jsx';
import styles from '../GuiaEstilos.module.css';
import { TEXTOS } from '../../textos.js';

export default function SeccionFormularios() {
  return (
    <section className={styles.seccion} aria-labelledby="sec-formularios">
      <div className={styles.cabeceraSeccion}>
        <h2 id="sec-formularios">Campos y controles (Field, Input, Select, Textarea)</h2>
        <p className={styles.descripcionSeccion}>
          Etiqueta, texto de ayuda y mensaje de error vinculados mediante atributos ARIA.
        </p>
      </div>
      <div className={styles.grillaDos}>
        <Field
          id="demo-correo"
          etiqueta={TEXTOS.login.correo}
          ayuda="Use su correo institucional (@utnfrc.edu.ar)."
          obligatorio
        >
          <Input type="email" defaultValue="david@utnfrc.edu.ar" />
        </Field>

        <Field
          id="demo-personas"
          etiqueta={TEXTOS.formulario.cantidadPersonas}
          error="La cantidad de personas supera la capacidad del aula (máx. 45)."
          obligatorio
        >
          <Input type="number" defaultValue="60" />
        </Field>

        <Field
          id="demo-aula"
          etiqueta={TEXTOS.formulario.aula}
          ayuda="Solo se listan las aulas activas."
          obligatorio
        >
          <Select placeholder="Elija un aula" opciones={OPCIONES_AULAS} defaultValue="1" />
        </Field>

        <Field
          id="demo-deshabilitado"
          etiqueta="Campo de solo lectura / deshabilitado"
          ayuda="No editable en este estado."
        >
          <Input defaultValue="Horario cerrado" disabled />
        </Field>

        <Field
          id="demo-motivo"
          etiqueta={TEXTOS.formulario.motivo}
          ayuda="Indique cátedra, comisión o actividad académica (máximo 255 caracteres)."
          obligatorio
        >
          <Textarea defaultValue="Parcial de Física II — Comisión 2K1" />
        </Field>

        <Field
          id="demo-motivo-error"
          etiqueta="Motivo con error de validación"
          error="Ingrese el motivo de la reserva."
          obligatorio
        >
          <Textarea defaultValue="" placeholder="Describa la actividad" />
        </Field>
      </div>
    </section>
  );
}
