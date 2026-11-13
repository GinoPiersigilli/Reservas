import { Button, EmptyState, ErrorState } from '../../components/ui/index.js';
import { CalendarPlus } from 'lucide-react';
import styles from '../GuiaEstilos.module.css';
import { TEXTOS } from '../../textos.js';

export default function SeccionBloques({ contadorReintentos, onReintentar }) {
  return (
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
          onReintentar={onReintentar}
        />
      </div>
      {contadorReintentos > 0 ? (
        <p className={styles.meta}>
          Acción «Reintentar» ejecutada {contadorReintentos}{' '}
          {contadorReintentos === 1 ? 'vez' : 'veces'}.
        </p>
      ) : null}
    </section>
  );
}
