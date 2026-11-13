import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aprobarReserva, cancelarReserva, rechazarReserva } from '../services/reservas.service.js';
import { TEXTOS } from '../textos.js';
import Button from './ui/Button.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import styles from './AccionesReserva.module.css';

const ESTADOS_ACTIVOS = ['pendiente', 'aprobada'];

/**
 * Cada acción con su permiso, su diálogo de confirmación y el llamado a la API.
 * El backend vuelve a verificar los permisos: esto solo decide qué se muestra.
 */
const ACCIONES = {
  aprobar: {
    etiqueta: TEXTOS.acciones.aprobar,
    variante: 'primario',
    titulo: TEXTOS.dialogos.aprobarTitulo,
    descripcion: TEXTOS.dialogos.aprobarDescripcion,
    mensajeExito: TEXTOS.reservas.aprobadaExito,
    ejecutar: aprobarReserva,
    permitida: ({ esAdmin, estado }) => esAdmin && estado === 'pendiente'
  },
  rechazar: {
    etiqueta: TEXTOS.acciones.rechazar,
    variante: 'peligro',
    titulo: TEXTOS.dialogos.rechazarTitulo,
    descripcion: TEXTOS.dialogos.rechazarDescripcion,
    mensajeExito: TEXTOS.reservas.rechazadaExito,
    ejecutar: rechazarReserva,
    permitida: ({ esAdmin, estado }) => esAdmin && estado === 'pendiente'
  },
  cancelar: {
    etiqueta: TEXTOS.acciones.cancelarReserva,
    variante: 'peligro',
    titulo: TEXTOS.dialogos.cancelarTitulo,
    descripcion: TEXTOS.dialogos.cancelarDescripcion,
    mensajeExito: TEXTOS.reservas.canceladaExito,
    ejecutar: cancelarReserva,
    // El solicitante puede cancelar la suya; un administrador, cualquiera.
    permitida: ({ esAdmin, esPropietario, estado }) =>
      (esAdmin || esPropietario) && ESTADOS_ACTIVOS.includes(estado)
  }
};

const puedeEditar = ({ esAdmin, estado }) => esAdmin && ESTADOS_ACTIVOS.includes(estado);

const AccionesReserva = ({ reserva, usuario, onAccion }) => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [dialogoActivo, setDialogoActivo] = useState(null);

  const contexto = {
    esAdmin: usuario?.rol === 'admin',
    esPropietario: usuario?.id === reserva.usuarioId,
    estado: reserva.estado
  };

  const disponibles = Object.entries(ACCIONES).filter(([, accion]) => accion.permitida(contexto));
  const mostrarEditar = puedeEditar(contexto);

  if (disponibles.length === 0 && !mostrarEditar) return null;

  const ejecutar = async (accion) => {
    setCargando(true);
    setError(null);
    try {
      await accion.ejecutar(reserva.id);
      setDialogoActivo(null);
      onAccion?.(accion.mensajeExito);
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
        {mostrarEditar ? (
          <Button
            variante="secundario"
            disabled={cargando}
            onClick={() => navigate(`/reservas/${reserva.id}/editar`)}
          >
            {TEXTOS.acciones.editar}
          </Button>
        ) : null}

        {disponibles.map(([clave, accion]) => (
          <Button
            key={clave}
            variante={accion.variante}
            disabled={cargando}
            onClick={() => setDialogoActivo(clave)}
          >
            {accion.etiqueta}
          </Button>
        ))}
      </div>

      {disponibles.map(([clave, accion]) => (
        <ConfirmDialog
          key={clave}
          abierto={dialogoActivo === clave}
          titulo={accion.titulo}
          descripcion={accion.descripcion}
          textoConfirmar={accion.etiqueta}
          textoCancelar={TEXTOS.acciones.cancelar}
          variante={accion.variante}
          cargando={cargando}
          onCancelar={() => setDialogoActivo(null)}
          onConfirmar={() => ejecutar(accion)}
        />
      ))}
    </div>
  );
};

export default AccionesReserva;
