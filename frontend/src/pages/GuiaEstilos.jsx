import { useState } from 'react';
import { CalendarPlus, Check, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  EstadoBadge,
  Field,
  Input,
  Select,
  TablaSkeleton,
  Table,
  Textarea,
  Toast
} from '../components/ui/index.js';
import { TEXTOS } from '../textos.js';
import styles from './GuiaEstilos.module.css';

const COLUMNAS_DEMO = [
  { key: 'id', titulo: '#', render: (fila) => `#${fila.id}` },
  { key: 'aula', titulo: 'Aula' },
  { key: 'fecha', titulo: 'Fecha' },
  { key: 'horario', titulo: 'Horario' },
  { key: 'motivo', titulo: 'Motivo' },
  {
    key: 'estado',
    titulo: 'Estado',
    render: (fila) => <EstadoBadge estado={fila.estado} />
  }
];

const DATOS_DEMO = [
  {
    id: 25,
    aula: 'Aula 910',
    fecha: '12/11/2026',
    horario: '10:00–12:00',
    motivo: 'Parcial de Física II',
    estado: 'pendiente'
  },
  {
    id: 24,
    aula: 'Laboratorio A6',
    fecha: '12/11/2026',
    horario: '14:00–16:00',
    motivo: 'Práctica de cátedra',
    estado: 'aprobada'
  },
  {
    id: 23,
    aula: 'Aula Magna',
    fecha: '10/11/2026',
    horario: '08:00–10:00',
    motivo: 'Jornada departamental',
    estado: 'rechazada'
  },
  {
    id: 22,
    aula: 'Sala de Reuniones B',
    fecha: '09/11/2026',
    horario: '16:00–18:00',
    motivo: 'Reunión de coordinación',
    estado: 'cancelada'
  }
];

const OPCIONES_AULAS = [
  { value: '1', label: 'Aula 910 (cap. 45)' },
  { value: '2', label: 'Laboratorio A6 (cap. 30)' },
  { value: '3', label: 'Aula Magna (cap. 150)' }
];

export default function GuiaEstilos() {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [toastActivo, setToastActivo] = useState(true);
  const [contadorReintentos, setContadorReintentos] = useState(0);

  return (
    <main className={styles.pagina}>
      <header className={styles.cabecera}>
        <h1>Guía de estilos y componentes base</h1>
        <p className={styles.subtitulo}>
          Fundaciones visuales de la Fase 3b-2 — Sistema institucional de reservas de aulas.
        </p>
      </header>

      <section className={styles.seccion} aria-labelledby="sec-tipografia">
        <div className={styles.cabeceraSeccion}>
          <h2 id="sec-tipografia">Tipografía y escala</h2>
          <p className={styles.descripcionSeccion}>
            Source Serif 4 (600) para títulos y Public Sans (400, 500, 600) para interfaz y tablas.
          </p>
        </div>
        <div className={styles.muestraTipografia}>
          <h1>Título de página (28 px — Source Serif 4)</h1>
          <h2>Título de sección (20 px — Source Serif 4)</h2>
          <h3>Subtítulo de bloque (16 px — Public Sans Semibold)</h3>
          <p className={styles.textoBase16}>
            Texto de formulario y lectura principal (16 px — Public Sans Regular). Largo de línea
            limitado a 70 caracteres para facilitar la lectura en paneles anchos.
          </p>
          <p className={styles.textoTabla14}>
            Texto denso de tabla y controles (14 px) con números tabulares: 08:00–10:00 · 12/11/2026
            · #25.
          </p>
          <p className={styles.textoAuxiliar13}>
            Texto auxiliar, etiquetas secundarias y notas al pie (13 px).
          </p>
        </div>
      </section>

      <section className={styles.seccion} aria-labelledby="sec-botones">
        <div className={styles.cabeceraSeccion}>
          <h2 id="sec-botones">Botones (Button)</h2>
          <p className={styles.descripcionSeccion}>
            Variantes primario, secundario y peligro; estados deshabilitado y cargando; íconos de
            línea de 16 px.
          </p>
        </div>
        <div className={styles.fila}>
          <Button variante="primario" icono={CalendarPlus}>
            {TEXTOS.acciones.reservarAula}
          </Button>
          <Button variante="secundario">{TEXTOS.acciones.guardarCambios}</Button>
          <Button variante="peligro" icono={Trash2}>
            {TEXTOS.acciones.cancelarReserva}
          </Button>
          <Button variante="primario" disabled>
            Deshabilitado
          </Button>
          <Button variante="primario" cargando>
            {TEXTOS.acciones.cargando}
          </Button>
          <Button variante="secundario" tamano="sm" icono={Check}>
            {TEXTOS.acciones.aprobar}
          </Button>
        </div>
      </section>

      <section className={styles.seccion} aria-labelledby="sec-estados">
        <div className={styles.cabeceraSeccion}>
          <h2 id="sec-estados">Indicadores de estado (EstadoBadge)</h2>
          <p className={styles.descripcionSeccion}>
            Siempre combinan ícono, texto y color con contraste AA verificado.
          </p>
        </div>
        <div className={styles.fila}>
          <EstadoBadge estado="pendiente" />
          <EstadoBadge estado="aprobada" />
          <EstadoBadge estado="rechazada" />
          <EstadoBadge estado="cancelada" />
        </div>
      </section>

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
            <Select
              placeholder="Elija un aula"
              opciones={OPCIONES_AULAS}
              defaultValue="1"
            />
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

      <section className={styles.seccion} aria-labelledby="sec-tablas">
        <div className={styles.cabeceraSeccion}>
          <h2 id="sec-tablas">Tabla de datos y esqueleto de carga (Table, TablaSkeleton)</h2>
          <p className={styles.descripcionSeccion}>
            Datos tabulares alineados a la izquierda con números y horarios en formato tabular.
          </p>
        </div>
        <Table
          ariaLabel="Ejemplo de reservas"
          columnas={COLUMNAS_DEMO}
          datos={DATOS_DEMO}
        />
        <h3>Esqueleto de tabla (TablaSkeleton)</h3>
        <TablaSkeleton
          filas={3}
          cabeceras={['#', 'Aula', 'Fecha', 'Horario', 'Motivo', 'Estado']}
        />
        <h3>Tabla vacía (Table con estado vacío integrado)</h3>
        <Table
          ariaLabel="Tabla sin resultados"
          columnas={COLUMNAS_DEMO}
          datos={[]}
          vacioTitulo={TEXTOS.reservas.vacioTitulo}
          vacioDescripcion={TEXTOS.reservas.vacioDescripcion}
        />
      </section>

      <section className={styles.seccion} aria-labelledby="sec-estados-bloque">
        <div className={styles.cabeceraSeccion}>
          <h2 id="sec-estados-bloque">Estados vacío y de error (EmptyState, ErrorState)</h2>
          <p className={styles.descripcionSeccion}>
            Explican qué ocurrió y ofrecen una acción directa para continuar.
          </p>
        </div>
        <div className={styles.grillaDos}>
          <EmptyState
            titulo={TEXTOS.reservas.vacioTitulo}
            descripcion={TEXTOS.reservas.vacioDescripcion}
            accion={
              <Button variante="primario" icono={CalendarPlus}>
                {TEXTOS.acciones.reservarAula}
              </Button>
            }
          />
          <ErrorState
            titulo={TEXTOS.reservas.errorTitulo}
            descripcion={TEXTOS.reservas.errorDescripcion}
            onReintentar={() => setContadorReintentos((c) => c + 1)}
          />
        </div>
        {contadorReintentos > 0 ? (
          <p className={styles.meta}>
            Acción «Reintentar» ejecutada {contadorReintentos}{' '}
            {contadorReintentos === 1 ? 'vez' : 'veces'}.
          </p>
        ) : null}
      </section>

      <section className={styles.seccion} aria-labelledby="sec-notificaciones">
        <div className={styles.cabeceraSeccion}>
          <h2 id="sec-notificaciones">Notificaciones y diálogo accesible (Toast, ConfirmDialog)</h2>
          <p className={styles.descripcionSeccion}>
            Avisos breves y diálogo modal que atrapa el foco, cierra con Escape y devuelve el foco.
          </p>
        </div>
        <div className={styles.grillaDos}>
          <div className={styles.pila}>
            <Toast
              tipo="exito"
              titulo="Operación completada"
              mensaje={TEXTOS.reservas.creadaExito}
            />
            <Toast
              tipo="advertencia"
              titulo="Solicitud pendiente"
              mensaje="La reserva requiere aprobación del administrador."
            />
            <Toast
              tipo="error"
              titulo="Conflicto de horario"
              mensaje="El aula 910 ya está reservada de 10:00 a 12:00. Elija otra franja."
            />
            {toastActivo ? (
              <Toast
                tipo="info"
                titulo="Aviso descartable"
                mensaje="Puede cerrar esta notificación con su botón."
                onCerrar={() => setToastActivo(false)}
              />
            ) : (
              <div>
                <Button variante="secundario" tamano="sm" onClick={() => setToastActivo(true)}>
                  Mostrar notificación nuevamente
                </Button>
              </div>
            )}
          </div>

          <div className={styles.pila}>
            <p className={styles.descripcionSeccion}>
              Pruebe abrir el diálogo con teclado: el foco queda atrapado entre sus botones, la
              tecla Escape lo cierra y el foco regresa al botón disparador.
            </p>
            <div>
              <Button
                variante="peligro"
                icono={Trash2}
                onClick={() => setDialogoAbierto(true)}
              >
                Abrir diálogo de confirmación
              </Button>
            </div>
          </div>
        </div>

        <ConfirmDialog
          abierto={dialogoAbierto}
          titulo={TEXTOS.dialogos.cancelarTitulo}
          descripcion={TEXTOS.dialogos.cancelarDescripcion}
          textoConfirmar={TEXTOS.acciones.cancelarReserva}
          textoCancelar={TEXTOS.acciones.cancelar}
          variante="peligro"
          onConfirmar={() => setDialogoAbierto(false)}
          onCancelar={() => setDialogoAbierto(false)}
        />
      </section>
    </main>
  );
}

