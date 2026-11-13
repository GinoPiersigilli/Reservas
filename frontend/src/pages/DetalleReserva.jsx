import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AccionesReserva from '../components/AccionesReserva.jsx';
import HistorialReserva from '../components/HistorialReserva.jsx';
import EstadoBadge from '../components/ui/EstadoBadge.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import TablaSkeleton from '../components/ui/TablaSkeleton.jsx';
import Toast from '../components/ui/Toast.jsx';
import { useReservaDetalle } from './detalle/useReservaDetalle.js';
import FichaReserva from './detalle/FichaReserva.jsx';
import MigasDetalle from './detalle/MigasDetalle.jsx';
import styles from './DetalleReserva.module.css';

/**
 * Detalle de una reserva: sus datos, las acciones disponibles según el rol y el
 * estado, y el historial de auditoría.
 */
const DetalleReserva = () => {
  const { id } = useParams();
  const { usuario } = useAuth();
  const { reserva, historial, nombresAulas, cargando, error, recargar } = useReservaDetalle(id);
  const [mensajeExito, setMensajeExito] = useState(null);

  /** Tras aprobar, rechazar o cancelar, se vuelven a pedir los datos. */
  const manejarAccionExito = async (mensaje) => {
    if (mensaje) setMensajeExito(mensaje);
    await recargar();
  };

  if (cargando) {
    return (
      <div className={styles.pagina}>
        <TablaSkeleton filas={6} columnas={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pagina}>
        <MigasDetalle />
        <ErrorState
          titulo="Error al cargar la reserva"
          descripcion={error}
          onReintentar={recargar}
        />
      </div>
    );
  }

  if (!reserva) return null;

  return (
    <div className={styles.pagina}>
      <MigasDetalle idReserva={reserva.id} />

      <header className={styles.cabecera}>
        <h1 className={styles.titulo}>Reserva #{reserva.id}</h1>
        <EstadoBadge estado={reserva.estado} />
      </header>

      {mensajeExito ? (
        <Toast tipo="exito" mensaje={mensajeExito} onCerrar={() => setMensajeExito(null)} />
      ) : null}

      <FichaReserva
        reserva={reserva}
        nombresAulas={nombresAulas}
        puedeVerSolicitante={usuario?.rol === 'admin' || Boolean(reserva.usuario)}
      >
        <AccionesReserva reserva={reserva} usuario={usuario} onAccion={manejarAccionExito} />
      </FichaReserva>

      <section className={styles.seccionHistorial} aria-labelledby="titulo-historial-reserva">
        <h2 id="titulo-historial-reserva" className={styles.tituloHistorial}>
          Historial de cambios
        </h2>
        <HistorialReserva historial={historial} />
      </section>
    </div>
  );
};

export default DetalleReserva;
