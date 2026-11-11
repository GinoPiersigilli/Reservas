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
  const totalReservas = resumen.totalReservas ?? Array.from(mapaPorEstado.values()).reduce(
    (acc, actual) => acc + actual,
    0
  );
  const cantidadPendientes =
    colaPendientes.length > 0
      ? colaPendientes.length
      : mapaPorEstado.get('pendiente') || 0;

  const distribucionEstados = Array.isArray(resumen.distribucionEstados) && resumen.distribucionEstados.length > 0
    ? resumen.distribucionEstados
    : ORDEN_ESTADOS.map((estadoKey) => {
        const cantidad = mapaPorEstado.get(estadoKey) || 0;
        const porcentaje = totalReservas > 0 ? Math.round((cantidad / totalReservas) * 100) : 0;
        return { estado: estadoKey, cantidad, porcentaje };
      });

  const tasaOcupacion = Array.isArray(resumen.tasaOcupacionAulas) ? resumen.tasaOcupacionAulas : [];

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
      render: (r) => {
        const nombre = r.usuario?.nombre || r.usuarioNombre || (r.usuarioId ? `Usuario #${r.usuarioId}` : '—');
        return (
          <span
            className={styles.solicitanteCelda}
            title={r.usuario?.email || nombre}
          >
            {nombre}
          </span>
        );
      }
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
        <span className={styles.valorCompacto}>{a.total ?? a.totalReservas}</span>
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
                  <span className={styles.separadorHoy} aria-hidden="true">
                    ·
                  </span>
                  <span
                    className={styles.solicitanteHoy}
                    title={r.usuario?.email || (r.usuario?.nombre || (r.usuarioId ? `Usuario #${r.usuarioId}` : undefined))}
                  >
                    {r.usuario?.nombre || r.usuarioNombre || (r.usuarioId ? `Usuario #${r.usuarioId}` : '—')}
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

      {/* 3. Métricas de gestión y analítica operativa */}
      {tasaOcupacion.length > 0 ? (
        <section className={styles.seccion} aria-labelledby="titulo-analitica-ocupacion">
          <div className={styles.cabeceraSeccion}>
            <h2 id="titulo-analitica-ocupacion" className={styles.tituloSeccion}>
              Métricas de gestión y ocupación mensual
            </h2>
            <span className={styles.contador}>
              {totalReservas} reservas analizadas
            </span>
          </div>
          <div className={styles.grillaMetricas}>
            {tasaOcupacion.map((item) => (
              <article key={item.aulaId} className={styles.tarjetaMetrica}>
                <div className={styles.cabeceraTarjetaMetrica}>
                  <span className={styles.nombreAula}>{item.nombre}</span>
                  <span className={styles.tasaValor}>{item.tasaOcupacion}%</span>
                </div>
                <progress
                  className={styles.progresoOcupacion}
                  value={item.tasaOcupacion}
                  max="100"
                  aria-label={`Tasa de ocupación de ${item.nombre}: ${item.tasaOcupacion}%`}
                >
                  {item.tasaOcupacion}%
                </progress>
                <div className={styles.pieTarjetaMetrica}>
                  <span>{item.horasOcupadas} hs reservadas</span>
                  {item.capacidad ? <span>Cap. {item.capacidad} pers.</span> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* 4. Datos compactos: Totales por estado y Aulas más reservadas */}
      <div className={styles.grillaSecundaria}>
        <section className={styles.bloqueCompacto} aria-labelledby="titulo-totales-estado">
          <h2 id="titulo-totales-estado" className={styles.tituloSeccion}>
            {TEXTOS.panel.totalesEstado}
          </h2>
          <dl className={styles.listaCompacta}>
            {distribucionEstados.map((item) => (
              <div key={item.estado} className={styles.filaCompacta}>
                <dt className={styles.etiquetaCompacta}>
                  {ETIQUETAS_TOTAL_ESTADO[item.estado] || item.estado}
                </dt>
                <dd className={styles.valorCompacto}>
                  {item.cantidad}
                  <span className={styles.porcentajeTexto}>({item.porcentaje}%)</span>
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
          {(!resumen.aulasMayorDemanda || resumen.aulasMayorDemanda.length === 0) &&
          (!resumen.porAula || resumen.porAula.length === 0) ? (
            <p className={styles.lineaVacia}>
              No hay registros de uso de aulas disponibles.
            </p>
          ) : (
            <Table
              ariaLabel="Aulas más reservadas"
              columnas={columnasPorAula}
              datos={
                resumen.aulasMayorDemanda && resumen.aulasMayorDemanda.length > 0
                  ? resumen.aulasMayorDemanda
                  : resumen.porAula
              }
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
