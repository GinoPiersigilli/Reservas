import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { TEXTOS } from '../../textos.js';
import { formatearFechaCorta } from '../../utils/formato.js';
import { nombreDeAula, nombreDeSolicitante } from './metricasPanel.js';
import styles from '../Resumen.module.css';

const rangoHorario = (reserva) =>
  `${String(reserva.horaInicio).slice(0, 5)}–${String(reserva.horaFin).slice(0, 5)}`;

/** Cola de pendientes: se aprueba o rechaza sin salir del panel. */
export const columnasPendientes = ({ nombresAulas, onAprobar, onRechazar }) => [
  {
    clave: 'id',
    titulo: '#',
    render: (r) => <span className={styles.idReserva}>#{r.id}</span>
  },
  {
    clave: 'aula',
    titulo: 'Aula',
    render: (r) => <span className={styles.nombreAula}>{nombreDeAula(r, nombresAulas)}</span>
  },
  {
    clave: 'fecha',
    titulo: 'Fecha',
    render: (r) => <span className={styles.textoTabular}>{formatearFechaCorta(r.fecha)}</span>
  },
  {
    clave: 'horario',
    titulo: 'Horario',
    render: (r) => <span className={styles.textoTabular}>{rangoHorario(r)}</span>
  },
  {
    clave: 'solicitante',
    titulo: 'Solicitante',
    render: (r) => (
      <span className={styles.solicitanteCelda} title={r.usuario?.email || nombreDeSolicitante(r)}>
        {nombreDeSolicitante(r)}
      </span>
    )
  },
  {
    clave: 'acciones',
    titulo: 'Acción',
    alineacion: 'derecha',
    render: (r) => (
      <div className={styles.accionesFila}>
        <Button tamano="sm" variante="primario" onClick={() => onAprobar(r)}>
          {TEXTOS.acciones.aprobar}
        </Button>
        <Button tamano="sm" variante="peligro" onClick={() => onRechazar(r)}>
          {TEXTOS.acciones.rechazar}
        </Button>
        <Link to={`/reservas/${r.id}`} className={styles.enlaceVer}>
          {TEXTOS.acciones.ver}
        </Link>
      </div>
    )
  }
];
