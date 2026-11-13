import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aprobarReserva, rechazarReserva, cancelarReserva } from '../services/reservas.service.js';
import { TEXTOS } from '../textos.js';
import Button from './ui/Button.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import styles from './AccionesReserva.module.css';

const AccionesReserva = ({ reserva, usuario, onAccion }) => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [dialogoActivo, setDialogoActivo] = useState(null); // 'aprobar' | 'rechazar' | 'cancelar' | null

  const esAdmin = usuario?.rol === 'admin';
  const esPropietario = usuario?.id === reserva.usuarioId;
  const { estado } = reserva;

  const puedeAprobar = esAdmin && estado === 'pendiente';
  const puedeRechazar = esAdmin && estado === 'pendiente';
  const puedeEditar = esAdmin && (estado === 'pendiente' || estado === 'aprobada');
  const puedeCancelar =
    (esAdmin || esPropietario) && (estado === 'pendiente' || estado === 'aprobada');

  if (!puedeAprobar && !puedeRechazar && !puedeEditar && !puedeCancelar) {
    return null;
  }

  const ejecutarAccion = async (accionFn, mensajeExito) => {
    setCargando(true);
    setError(null);
    try {
      await accionFn();
      setDialogoActivo(null);
      onAccion?.(mensajeExito);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar la acción.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className={styles.barraAcciones}>
      {error ? (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      ) : null}

      <div className={styles.botones}>
        {puedeEditar ? (
          <Button
            variante="secundario"
            disabled={cargando}
            onClick={() => navigate(`/reservas/${reserva.id}/editar`)}
          >
            {TEXTOS.acciones.editar}
          </Button>
        ) : null}

        {puedeAprobar ? (
          <Button
            variante="primario"
            disabled={cargando}
            onClick={() => setDialogoActivo('aprobar')}
          >
            {TEXTOS.acciones.aprobar}
          </Button>
        ) : null}

        {puedeRechazar ? (
          <Button
            variante="peligro"
            disabled={cargando}
            onClick={() => setDialogoActivo('rechazar')}
          >
            {TEXTOS.acciones.rechazar}
          </Button>
        ) : null}

        {puedeCancelar ? (
          <Button
            variante="peligro"
            disabled={cargando}
            onClick={() => setDialogoActivo('cancelar')}
          >
            {TEXTOS.acciones.cancelarReserva}
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        abierto={dialogoActivo === 'aprobar'}
        titulo={TEXTOS.dialogos.aprobarTitulo}
        descripcion={TEXTOS.dialogos.aprobarDescripcion}
        textoConfirmar={TEXTOS.acciones.aprobar}
        textoCancelar={TEXTOS.acciones.cancelar}
        variante="primario"
        cargando={cargando}
        onCancelar={() => setDialogoActivo(null)}
        onConfirmar={() =>
          ejecutarAccion(() => aprobarReserva(reserva.id), TEXTOS.reservas.aprobadaExito)
        }
      />

      <ConfirmDialog
        abierto={dialogoActivo === 'rechazar'}
        titulo={TEXTOS.dialogos.rechazarTitulo}
        descripcion={TEXTOS.dialogos.rechazarDescripcion}
        textoConfirmar={TEXTOS.acciones.rechazar}
        textoCancelar={TEXTOS.acciones.cancelar}
        variante="peligro"
        cargando={cargando}
        onCancelar={() => setDialogoActivo(null)}
        onConfirmar={() =>
          ejecutarAccion(() => rechazarReserva(reserva.id), TEXTOS.reservas.rechazadaExito)
        }
      />

      <ConfirmDialog
        abierto={dialogoActivo === 'cancelar'}
        titulo={TEXTOS.dialogos.cancelarTitulo}
        descripcion={TEXTOS.dialogos.cancelarDescripcion}
        textoConfirmar={TEXTOS.acciones.cancelarReserva}
        textoCancelar={TEXTOS.acciones.cancelar}
        variante="peligro"
        cargando={cargando}
        onCancelar={() => setDialogoActivo(null)}
        onConfirmar={() =>
          ejecutarAccion(() => cancelarReserva(reserva.id), TEXTOS.reservas.canceladaExito)
        }
      />
    </div>
  );
};

export default AccionesReserva;
