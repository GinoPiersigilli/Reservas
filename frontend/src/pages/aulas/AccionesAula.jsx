import { Button } from '../../components/ui/index.js';
import { TEXTOS } from '../../textos.js';
import styles from '../Aulas.module.css';

/** Acciones disponibles según el aula esté activa o dada de baja. */
export default function AccionesAula({ aula, onEditar, onDesactivar, onReactivar }) {
  return (
    <div className={styles.accionesCelda}>
      <Button
        variante="secundario"
        onClick={() => onEditar(aula)}
        aria-label={`Editar ${aula.nombre}`}
      >
        {TEXTOS.acciones.editar}
      </Button>

      {aula.activa ? (
        <Button
          variante="peligro"
          onClick={() => onDesactivar(aula)}
          aria-label={`Desactivar ${aula.nombre}`}
        >
          {TEXTOS.aulas.desactivar}
        </Button>
      ) : (
        <Button
          variante="secundario"
          onClick={() => onReactivar(aula)}
          aria-label={`Reactivar ${aula.nombre}`}
        >
          {TEXTOS.aulas.reactivar}
        </Button>
      )}
    </div>
  );
}
