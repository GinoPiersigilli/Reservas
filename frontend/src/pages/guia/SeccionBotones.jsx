import { CalendarPlus, Check, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/index.js';
import styles from '../GuiaEstilos.module.css';
import { TEXTOS } from '../../textos.js';

export default function SeccionBotones() {
  return (
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
  );
}
