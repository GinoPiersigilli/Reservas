import { useState } from 'react';
import { aprobarReserva, rechazarReserva } from '../services/reservas.service.js';
import { TEXTOS } from '../textos.js';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import Table from '../components/ui/Table.jsx';
import TablaSkeleton from '../components/ui/TablaSkeleton.jsx';
import Toast from '../components/ui/Toast.jsx';
import { usePanel } from './resumen/usePanel.js';
import { calcularMetricas } from './resumen/metricasPanel.js';
import { columnasPendientes, columnasPorAula } from './resumen/columnasPanel.jsx';
import ReservasDeHoy from './resumen/ReservasDeHoy.jsx';
import OcupacionAulas from './resumen/OcupacionAulas.jsx';
import TotalesPorEstado from './resumen/TotalesPorEstado.jsx';
import styles from './Resumen.module.css';

/** Textos del diálogo según la acción que se va a confirmar. */
const DIALOGOS = {
  aprobar: {
    titulo: TEXTOS.dialogos.aprobarTitulo,
    descripcion: TEXTOS.dialogos.aprobarDescripcion,
    textoConfirmar: TEXTOS.acciones.aprobar,
    variante: 'primario',
    ejecutar: aprobarReserva,
    mensajeExito: TEXTOS.reservas.aprobadaExito
  },
  rechazar: {
    titulo: TEXTOS.dialogos.rechazarTitulo,
    descripcion: TEXTOS.dialogos.rechazarDescripcion,
    textoConfirmar: TEXTOS.acciones.rechazar,
    variante: 'peligro',
    ejecutar: rechazarReserva,
    mensajeExito: TEXTOS.reservas.rechazadaExito
  }
};

function Cabecera() {
  return (
    <header className={styles.cabecera}>
      <h1 className={styles.titulo}>{TEXTOS.panel.titulo}</h1>
    </header>
  );
}

/**
 * Panel administrativo: cola de solicitudes pendientes, reservas del día y
 * métricas de ocupación. Solo accesible para administradores.
 */
const Resumen = () => {
  const { resumen, colaPendientes, nombresAulas, cargando, error, recargar } = usePanel();

  const [confirmacion, setConfirmacion] = useState(null);
  const [accionEnCurso, setAccionEnCurso] = useState(false);
  const [mensajeToast, setMensajeToast] = useState(null);

  const confirmarAccion = async () => {
    if (!confirmacion?.reserva) return;

    const accion = DIALOGOS[confirmacion.tipo];
    setAccionEnCurso(true);

    try {
      await accion.ejecutar(confirmacion.reserva.id);
      setMensajeToast({ tipo: 'exito', texto: accion.mensajeExito });
      await recargar();
    } catch (err) {
      setMensajeToast({
        tipo: 'error',
        texto: err.response?.data?.error || 'No se pudo procesar la solicitud.'
      });
    } finally {
      setConfirmacion(null);
      setAccionEnCurso(false);
    }
  };

  if (cargando) {
    return (
      <div className={styles.pagina}>
        <Cabecera />
        <TablaSkeleton filas={4} columnas={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pagina}>
        <Cabecera />
        <ErrorState titulo="Error al cargar el panel" descripcion={error} onReintentar={recargar} />
      </div>
    );
  }

  if (!resumen) return null;

  const metricas = calcularMetricas(resumen, colaPendientes);
  const dialogo = confirmacion ? DIALOGOS[confirmacion.tipo] : null;

  return (
    <div className={styles.pagina}>
      <Cabecera />

      {mensajeToast ? (
        <Toast
          tipo={mensajeToast.tipo}
          mensaje={mensajeToast.texto}
          onCerrar={() => setMensajeToast(null)}
        />
      ) : null}

      <section className={styles.seccion} aria-labelledby="titulo-pendientes">
        <div className={styles.cabeceraSeccion}>
          <h2 id="titulo-pendientes" className={styles.tituloSeccion}>
            {TEXTOS.panel.pendientesTitulo} ({metricas.cantidadPendientes})
          </h2>
        </div>

        {colaPendientes.length === 0 ? (
          <p className={styles.lineaVacia}>{TEXTOS.panel.sinPendientes}</p>
        ) : (
          <Table
            ariaLabel="Cola de reservas pendientes de aprobación"
            columnas={columnasPendientes({
              nombresAulas,
              onAprobar: (reserva) => setConfirmacion({ tipo: 'aprobar', reserva }),
              onRechazar: (reserva) => setConfirmacion({ tipo: 'rechazar', reserva })
            })}
            datos={colaPendientes}
          />
        )}
      </section>

      <ReservasDeHoy reservas={resumen.proximasHoy || []} nombresAulas={nombresAulas} />

      <OcupacionAulas
        tasaOcupacion={metricas.tasaOcupacion}
        totalReservas={metricas.totalReservas}
      />

      <div className={styles.grillaSecundaria}>
        <TotalesPorEstado
          distribucionEstados={metricas.distribucionEstados}
          totalReservas={metricas.totalReservas}
        />

        <section className={styles.bloqueCompacto} aria-labelledby="titulo-aulas-frecuentes">
          <h2 id="titulo-aulas-frecuentes" className={styles.tituloSeccion}>
            {TEXTOS.panel.aulasMasReservadas}
          </h2>
          {metricas.aulasMasReservadas.length === 0 ? (
            <p className={styles.lineaVacia}>No hay registros de uso de aulas disponibles.</p>
          ) : (
            <Table
              ariaLabel="Aulas más reservadas"
              columnas={columnasPorAula({ nombresAulas })}
              datos={metricas.aulasMasReservadas}
              claveFila="aulaId"
            />
          )}
        </section>
      </div>

      <ConfirmDialog
        abierto={Boolean(confirmacion)}
        titulo={dialogo?.titulo}
        descripcion={dialogo?.descripcion}
        textoConfirmar={dialogo?.textoConfirmar}
        textoCancelar={TEXTOS.acciones.cancelar}
        variante={dialogo?.variante || 'peligro'}
        cargando={accionEnCurso}
        onCancelar={() => setConfirmacion(null)}
        onConfirmar={confirmarAccion}
      />
    </div>
  );
};

export default Resumen;
