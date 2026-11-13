import { formatearFechaHora } from '../utils/formato.js';
import Table from './ui/Table.jsx';
import styles from './HistorialReserva.module.css';

const ETIQUETAS_ACCION = {
  creacion: 'Creación',
  edicion: 'Edición',
  aprobacion: 'Aprobación',
  rechazo: 'Rechazo',
  cancelacion: 'Cancelación',
  creada: 'Creación',
  aprobada: 'Aprobación',
  rechazada: 'Rechazo',
  cancelada: 'Cancelación',
  editada: 'Edición'
};

function formatearValorHistorial(valor) {
  if (!valor) return null;
  if (typeof valor === 'string') {
    try {
      const parseado = JSON.parse(valor);
      if (parseado && typeof parseado === 'object') {
        return formatearObjetoCambio(parseado);
      }
    } catch {
      return valor;
    }
    return valor;
  }
  if (typeof valor === 'object') {
    return formatearObjetoCambio(valor);
  }
  return String(valor);
}

function formatearObjetoCambio(obj) {
  const pares = [];
  if (obj.estado) pares.push(`Estado: ${obj.estado}`);
  if (obj.aulaId) pares.push(`Aula #${obj.aulaId}`);
  if (obj.fecha) pares.push(`Fecha: ${String(obj.fecha).slice(0, 10)}`);
  if (obj.horaInicio && obj.horaFin) {
    pares.push(`Horario: ${String(obj.horaInicio).slice(0, 5)}–${String(obj.horaFin).slice(0, 5)}`);
  }
  if (obj.cantidadPersonas) pares.push(`Personas: ${obj.cantidadPersonas}`);
  if (obj.motivo) pares.push(`Motivo: ${obj.motivo}`);
  return pares.length > 0 ? pares.join(' · ') : JSON.stringify(obj);
}

const HistorialReserva = ({ historial = [] }) => {
  const columnas = [
    {
      key: 'fechaHora',
      titulo: 'Fecha y hora',
      render: (item) => (
        <span className={styles.fechaCelda}>{formatearFechaHora(item.fechaHora)}</span>
      )
    },
    {
      key: 'accion',
      titulo: 'Acción',
      render: (item) => (
        <span className={styles.accionTexto}>{ETIQUETAS_ACCION[item.accion] || item.accion}</span>
      )
    },
    {
      key: 'usuario',
      titulo: 'Usuario',
      render: (item) => (
        <span className={styles.usuarioTexto}>
          {item.usuario?.nombre || item.usuarioNombre || `Usuario #${item.usuarioId}`}
        </span>
      )
    },
    {
      key: 'detalle',
      titulo: 'Detalle',
      render: (item) => {
        const anterior = formatearValorHistorial(item.valorAnterior);
        const nuevo = formatearValorHistorial(item.valorNuevo);
        if (!anterior && !nuevo) {
          return <span className={styles.detalleContenedor}>—</span>;
        }
        return (
          <div className={styles.detalleContenedor}>
            {anterior ? (
              <div>
                <span className={styles.etiquetaDetalle}>Anterior:</span> {anterior}
              </div>
            ) : null}
            {nuevo ? (
              <div>
                <span className={styles.etiquetaDetalle}>Nuevo:</span> {nuevo}
              </div>
            ) : null}
          </div>
        );
      }
    }
  ];

  return (
    <Table
      ariaLabel="Historial de cambios de la reserva"
      columnas={columnas}
      datos={historial}
      vacioTitulo="Sin historial de cambios"
      vacioDescripcion="Todavía no se registraron cambios sobre esta reserva."
    />
  );
};

export default HistorialReserva;
