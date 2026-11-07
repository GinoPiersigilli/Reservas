import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getResumen,
  getReservas,
  aprobarReserva,
  rechazarReserva
} from '../services/reservas.service.js';
import { getAulas } from '../services/aula.service.js';
import { TEXTOS } from '../textos.js';
import { formatearFecha } from '../utils/formato.js';
import Button from '../components/ui/Button.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import EstadoBadge from '../components/ui/EstadoBadge.jsx';
import Table from '../components/ui/Table.jsx';
import TablaSkeleton from '../components/ui/TablaSkeleton.jsx';
import Toast from '../components/ui/Toast.jsx';
import styles from './Resumen.module.css';

const ORDEN_ESTADOS = ['aprobada', 'pendiente', 'rechazada', 'cancelada'];

const ETIQUETAS_TOTAL_ESTADO = {
  aprobada: 'Aprobadas',
  pendiente: 'Pendientes',
  rechazada: 'Rechazadas',
  cancelada: 'Canceladas'
};

const Resumen = () => {
  const [resumen, setResumen] = useState(null);
  const [colaPendientes, setColaPendientes] = useState([]);
  const [mapaAulas, setMapaAulas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [accionEnCurso, setAccionEnCurso] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null); // { tipo: 'aprobar' | 'rechazar', reserva }
  const [mensajeToast, setMensajeToast] = useState(null);

  const cargarPanel = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const promesaPendientes =
        typeof getReservas === 'function'
          ? Promise.resolve(
              getReservas({
                estado: 'pendiente',
                limit: 50,
                sortBy: 'fecha',
                order: 'ASC'
              })
            ).catch(() => ({ data: { data: [] } }))
          : Promise.resolve({ data: { data: [] } });

      const promesaAulas =
        typeof getAulas === 'function'
          ? Promise.resolve(getAulas()).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

      const [resResumen, resPendientes, resAulas] = await Promise.all([
        getResumen(),
        promesaPendientes,
        promesaAulas
      ]);

      setResumen(resResumen.data);
      const listaPendientes = Array.isArray(resPendientes?.data?.datos)
        ? resPendientes.data.datos
        : Array.isArray(resPendientes?.data?.data)
          ? resPendientes.data.data
          : Array.isArray(resPendientes?.data)
            ? resPendientes.data
            : [];
      setColaPendientes(listaPendientes);
      if (Array.isArray(resAulas?.data)) {
        const mapa = {};
        resAulas.data.forEach((a) => {
          mapa[a.id] = a.nombre;
        });
        setMapaAulas(mapa);
      }
    } catch (err) {
      setError(err.response?.data?.error || TEXTOS.panel.errorCarga);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarPanel();
  }, [cargarPanel]);

  const confirmarAccion = async () => {
    if (!confirmacion?.reserva) return;
    const { tipo, reserva } = confirmacion;
    setAccionEnCurso(true);
    try {
      if (tipo === 'aprobar') {
        await aprobarReserva(reserva.id);
        setMensajeToast({
          variante: 'exito',
          texto: TEXTOS.reservas.aprobadaExito
        });
      } else {
        await rechazarReserva(reserva.id);
        setMensajeToast({
          variante: 'exito',
          texto: TEXTOS.reservas.rechazadaExito
        });
      }
      setConfirmacion(null);
      await cargarPanel();
    } catch (err) {
      setMensajeToast({
        variante: 'error',
        texto: err.response?.data?.error || 'No se pudo procesar la solicitud.'
      });
      setConfirmacion(null);
    } finally {
      setAccionEnCurso(false);
    }
  };

  if (cargando) {
    return (
      <div className={styles.pagina}>
        <header className={styles.cabecera}>
          <h1 className={styles.titulo}>{TEXTOS.panel.titulo}</h1>
        </header>
        <TablaSkeleton filas={4} columnas={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pagina}>
        <header className={styles.cabecera}>
          <h1 className={styles.titulo}>{TEXTOS.panel.titulo}</h1>
        </header>
        <ErrorState
          titulo="Error al cargar el panel"
          descripcion={error}
          onReintentar={cargarPanel}
        />
      </div>
    );
  }

  if (!resumen) return null;

  const mapaPorEstado = new Map(
    (resumen.porEstado || []).map((item) => [item.estado, Number(item.total) || 0])
  );
  const totalReservas = Array.from(mapaPorEstado.values()).reduce(
    (acc, actual) => acc + actual,
    0
  );
  const cantidadPendientes =
    colaPendientes.length > 0
      ? colaPendientes.length
      : mapaPorEstado.get('pendiente') || 0;

  const obtenerNombreAula = (item) =>
    item.aula?.nombre ||
    item.nombre ||
    item.aulaNombre ||
    mapaAulas[item.aulaId] ||
    `Aula ${item.aulaId}`;

  const columnasPendientes = [
    {
      key: 'id',
      titulo: '#',
      render: (r) => <span className={styles.idReserva}>#{r.id}</span>
    },
    {
      key: 'aula',
      titulo: 'Aula',
      render: (r) => (
        <span className={styles.nombreAula}>
          {obtenerNombreAula(r)}
        </span>
      )
    },
    {
      key: 'fecha',
      titulo: 'Fecha',
      render: (r) => (
        <span className={styles.textoTabular}>{formatearFecha(r.fecha)}</span>
      )
    },
    {
      key: 'horario',
      titulo: 'Horario',
      render: (r) => (
        <span className={styles.textoTabular}>
          {String(r.horaInicio).slice(0, 5)}–{String(r.horaFin).slice(0, 5)}
        </span>
      )
    },
    {
      key: 'solicitante',
      titulo: 'Solicitante',
      render: (r) =>
        r.usuario?.nombre || r.usuarioNombre || `Usuario #${r.usuarioId}`
    },
    {
      key: 'acciones',
      titulo: 'Acción',
      align: 'right',
      render: (r) => (
        <div className={styles.accionesFila}>
          <Button
            tamano="sm"
            variante="primario"
            onClick={() => setConfirmacion({ tipo: 'aprobar', reserva: r })}
          >
            {TEXTOS.acciones.aprobar}
          </Button>
          <Button
            tamano="sm"
            variante="peligro"
            onClick={() => setConfirmacion({ tipo: 'rechazar', reserva: r })}
          >
            {TEXTOS.acciones.rechazar}
          </Button>
          <Link to={`/reservas/${r.id}`} className={styles.enlaceVer}>
            {TEXTOS.acciones.ver}
          </Link>
        </div>
      )
    }
  ];

  const columnasPorAula = [
    {
      key: 'aula',
      titulo: 'Aula',
      render: (a) => (
        <span className={styles.nombreAula}>
          {obtenerNombreAula(a)}
        </span>
      )
    },
    {
      key: 'total',
      titulo: 'Reservas',
      align: 'right',
      render: (a) => (
        <span className={styles.valorCompacto}>{a.total}</span>
      )
    }
  ];

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <h1 className={styles.titulo}>{TEXTOS.panel.titulo}</h1>
      </header>

      {mensajeToast ? (
        <Toast
          variante={mensajeToast.variante}
          mensaje={mensajeToast.texto}
          onCerrar={() => setMensajeToast(null)}
        />
      ) : null}

      {/* 1. Cola de solicitudes pendientes de aprobación */}
      <section className={styles.seccion} aria-labelledby="titulo-pendientes">
        <div className={styles.cabeceraSeccion}>
          <h2 id="titulo-pendientes" className={styles.tituloSeccion}>
            {TEXTOS.panel.pendientesTitulo} ({cantidadPendientes})
          </h2>
        </div>

        {colaPendientes.length === 0 ? (
          <p className={styles.lineaVacia}>{TEXTOS.panel.sinPendientes}</p>
        ) : (
          <Table
            ariaLabel="Cola de reservas pendientes de aprobación"
            columnas={columnasPendientes}
            datos={colaPendientes}
          />
        )}
      </section>

      {/* 2. Reservas de hoy */}
      <section className={styles.seccion} aria-labelledby="titulo-hoy">
        <div className={styles.cabeceraSeccion}>
          <h2 id="titulo-hoy" className={styles.tituloSeccion}>
            {TEXTOS.panel.hoyTitulo}
          </h2>
        </div>

        {!resumen.proximasHoy || resumen.proximasHoy.length === 0 ? (
          <p className={styles.lineaVacia}>{TEXTOS.panel.sinReservasHoy}</p>
        ) : (
          <ul className={styles.listaHoy}>
            {resumen.proximasHoy.map((r) => (
              <li key={r.id} className={styles.itemHoy}>
                <div className={styles.infoHoy}>
                  <span className={styles.horarioHoy}>
                    {String(r.horaInicio).slice(0, 5)}–{String(r.horaFin).slice(0, 5)}
                  </span>
                  <span className={styles.separadorHoy} aria-hidden="true">
                    ·
                  </span>
                  <span className={styles.nombreAula}>
                    {obtenerNombreAula(r)}
                  </span>
                  {r.motivo ? (
                    <>
                      <span className={styles.separadorHoy} aria-hidden="true">
                        ·
                      </span>
                      <span className={styles.motivoHoy}>{r.motivo}</span>
                    </>
                  ) : null}
                </div>
                <div className={styles.metaHoy}>
                  <EstadoBadge estado={r.estado} />
                  <Link to={`/reservas/${r.id}`} className={styles.enlaceVer}>
                    {TEXTOS.acciones.ver}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. Datos compactos: Totales por estado y Aulas más reservadas */}
      <div className={styles.grillaSecundaria}>
        <section className={styles.bloqueCompacto} aria-labelledby="titulo-totales-estado">
          <h2 id="titulo-totales-estado" className={styles.tituloSeccion}>
            {TEXTOS.panel.totalesEstado}
          </h2>
          <dl className={styles.listaCompacta}>
            {ORDEN_ESTADOS.map((estadoKey) => (
              <div key={estadoKey} className={styles.filaCompacta}>
                <dt className={styles.etiquetaCompacta}>
                  {ETIQUETAS_TOTAL_ESTADO[estadoKey]}
                </dt>
                <dd className={styles.valorCompacto}>
                  {mapaPorEstado.get(estadoKey) || 0}
                </dd>
              </div>
            ))}
            <div className={styles.filaCompacta}>
              <dt className={[styles.etiquetaCompacta, styles.etiquetaTotal].join(' ')}>
                Total
              </dt>
              <dd className={styles.valorCompacto}>{totalReservas}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.bloqueCompacto} aria-labelledby="titulo-aulas-frecuentes">
          <h2 id="titulo-aulas-frecuentes" className={styles.tituloSeccion}>
            {TEXTOS.panel.aulasMasReservadas}
          </h2>
          {!resumen.porAula || resumen.porAula.length === 0 ? (
            <p className={styles.lineaVacia}>
              No hay registros de uso de aulas disponibles.
            </p>
          ) : (
            <Table
              ariaLabel="Aulas más reservadas"
              columnas={columnasPorAula}
              datos={resumen.porAula}
              claveFila="aulaId"
            />
          )}
        </section>
      </div>

      <ConfirmDialog
        abierto={Boolean(confirmacion)}
        titulo={
          confirmacion?.tipo === 'aprobar'
            ? TEXTOS.dialogos.aprobarTitulo
            : TEXTOS.dialogos.rechazarTitulo
        }
        descripcion={
          confirmacion?.tipo === 'aprobar'
            ? TEXTOS.dialogos.aprobarDescripcion
            : TEXTOS.dialogos.rechazarDescripcion
        }
        textoConfirmar={
          confirmacion?.tipo === 'aprobar'
            ? TEXTOS.acciones.aprobar
            : TEXTOS.acciones.rechazar
        }
        textoCancelar={TEXTOS.acciones.cancelar}
        variante={confirmacion?.tipo === 'aprobar' ? 'primario' : 'peligro'}
        cargando={accionEnCurso}
        onCancelar={() => setConfirmacion(null)}
        onConfirmar={confirmarAccion}
      />
    </div>
  );
};

export default Resumen;
