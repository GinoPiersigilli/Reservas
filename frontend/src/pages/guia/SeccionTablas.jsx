import { Table, TablaSkeleton } from '../../components/ui/index.js';
import { COLUMNAS_DEMO, DATOS_DEMO } from './datosDemo.jsx';
import styles from '../GuiaEstilos.module.css';
import { TEXTOS } from '../../textos.js';

export default function SeccionTablas() {
  return (
    <section className={styles.seccion} aria-labelledby="sec-tablas">
      <div className={styles.cabeceraSeccion}>
        <h2 id="sec-tablas">Tabla de datos y esqueleto de carga (Table, TablaSkeleton)</h2>
        <p className={styles.descripcionSeccion}>
          Datos tabulares alineados a la izquierda con números y horarios en formato tabular.
        </p>
      </div>
      <Table ariaLabel="Ejemplo de reservas" columnas={COLUMNAS_DEMO} datos={DATOS_DEMO} />
      <h3>Esqueleto de tabla (TablaSkeleton)</h3>
      <TablaSkeleton filas={3} cabeceras={['#', 'Aula', 'Fecha', 'Horario', 'Motivo', 'Estado']} />
      <h3>Tabla vacía (Table con estado vacío integrado)</h3>
      <Table
        ariaLabel="Tabla sin resultados"
        columnas={COLUMNAS_DEMO}
        datos={[]}
        vacioTitulo={TEXTOS.reservas.vacioTitulo}
        vacioDescripcion={TEXTOS.reservas.vacioDescripcion}
      />
    </section>
  );
}
