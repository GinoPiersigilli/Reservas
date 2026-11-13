import { EstadoBadge } from '../../components/ui/index.js';
import { TEXTOS } from '../../textos.js';
import AccionesAula from './AccionesAula.jsx';
import ListaRecursos from './ListaRecursos.jsx';
import styles from '../Aulas.module.css';

export const CABECERAS_AULAS = [
  TEXTOS.aulas.nombre,
  TEXTOS.aulas.ubicacion,
  TEXTOS.aulas.capacidad,
  TEXTOS.aulas.recursos,
  TEXTOS.aulas.estado,
  TEXTOS.aulas.acciones
];

/** Columnas de la tabla de aulas, con los manejadores de cada acción. */
export const columnasAulas = ({ onEditar, onDesactivar, onReactivar }) => [
  {
    clave: 'nombre',
    titulo: TEXTOS.aulas.nombre,
    render: (aula) => <span className={styles.nombreAula}>{aula.nombre}</span>
  },
  {
    clave: 'ubicacion',
    titulo: TEXTOS.aulas.ubicacion
  },
  {
    clave: 'capacidad',
    titulo: TEXTOS.aulas.capacidad,
    alineacion: 'derecha'
  },
  {
    clave: 'recursos',
    titulo: TEXTOS.aulas.recursos,
    render: (aula) => <ListaRecursos recursos={aula.recursos} />
  },
  {
    clave: 'estado',
    titulo: TEXTOS.aulas.estado,
    render: (aula) => <EstadoBadge estado={aula.activa ? 'activa' : 'inactiva'} />
  },
  {
    clave: 'acciones',
    titulo: TEXTOS.aulas.acciones,
    alineacion: 'derecha',
    render: (aula) => (
      <AccionesAula
        aula={aula}
        onEditar={onEditar}
        onDesactivar={onDesactivar}
        onReactivar={onReactivar}
      />
    )
  }
];
