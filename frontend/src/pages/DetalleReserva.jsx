import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getReserva, getHistorial } from '../services/reservas.service.js';
import { getAulas } from '../services/aula.service.js';
import { TEXTOS } from '../textos.js';
import { formatearFecha, formatearFechaHora, calcularDuracionTexto } from '../utils/formato.js';
import AccionesReserva from '../components/AccionesReserva.jsx';
import HistorialReserva from '../components/HistorialReserva.jsx';
import EstadoBadge from '../components/ui/EstadoBadge.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import TablaSkeleton from '../components/ui/TablaSkeleton.jsx';
import Toast from '../components/ui/Toast.jsx';
import styles from './DetalleReserva.module.css';

const DetalleReserva = () => {
  const { id } = useParams();
  const { usuario } = useAuth();

  const [reserva, setReserva] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [mapaAulas, setMapaAulas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const promesaAulas =
        typeof getAulas === 'function'
          ? Promise.resolve(getAulas()).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

      const [resReserva, resHistorial, resAulas] = await Promise.all([
        getReserva(id),
        getHistorial(id),
        promesaAulas
      ]);
      setReserva(resReserva.data);
      setHistorial(resHistorial.data || []);
      if (Array.isArray(resAulas?.data)) {
        const mapa = {};
        resAulas.data.forEach((a) => {
          mapa[a.id] = a.nombre;
        });
        setMapaAulas(mapa);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la reserva.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  const manejarAccionExito = async (mensaje) => {
    if (mensaje) {
      setMensajeExito(mensaje);
    }
    await cargarDatos();
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
        <nav aria-label="Ruta de navegación" className={styles.migas}>
          <Link to="/reservas" className={styles.enlaceMiga}>
            {TEXTOS.reservas.migasRaiz}
          </Link>
        </nav>
        <ErrorState
          titulo="Error al cargar la reserva"
          descripcion={error}
          onReintentar={cargarDatos}
        />
      </div>
    );
  }

  if (!reserva) return null;

  const duracion = calcularDuracionTexto(reserva.horaInicio, reserva.horaFin);
  const nombreAula =
    reserva.aula?.nombre ||
    reserva.aulaNombre ||
    mapaAulas[reserva.aulaId] ||
    `Aula ${reserva.aulaId}`;
  const nombreSolicitante =
    reserva.usuario?.nombre || reserva.usuarioNombre || `Usuario #${reserva.usuarioId}`;

  return (
    <div className={styles.pagina}>
      <nav aria-label="Ruta de navegación" className={styles.migas}>
        <Link to="/reservas" className={styles.enlaceMiga}>
          {TEXTOS.reservas.migasRaiz}
        </Link>
        <span className={styles.separadorMiga} aria-hidden="true">
          /
        </span>
        <span className={styles.actualMiga} aria-current="page">
          #{reserva.id}
        </span>
      </nav>

      <header className={styles.cabecera}>
        <h1 className={styles.titulo}>Reserva #{reserva.id}</h1>
        <EstadoBadge estado={reserva.estado} />
      </header>

      {mensajeExito ? (
        <Toast variante="exito" mensaje={mensajeExito} onCerrar={() => setMensajeExito(null)} />
      ) : null}

      <section className={styles.ficha} aria-labelledby="titulo-ficha-reserva">
        <h2 id="titulo-ficha-reserva" className={styles.subtituloFicha}>
          Datos de la reserva
        </h2>

        <dl className={styles.listaDatos}>
          <div className={styles.filaDato}>
            <dt className={styles.etiquetaDato}>Aula</dt>
            <dd className={[styles.valorDato, styles.valorDestacado].join(' ')}>{nombreAula}</dd>
          </div>

          <div className={styles.filaDato}>
            <dt className={styles.etiquetaDato}>Fecha</dt>
            <dd className={styles.valorDato}>{formatearFecha(reserva.fecha)}</dd>
          </div>

          <div className={styles.filaDato}>
            <dt className={styles.etiquetaDato}>Horario</dt>
            <dd className={styles.valorDato}>
              <span>
                {String(reserva.horaInicio).slice(0, 5)}–{String(reserva.horaFin).slice(0, 5)}
              </span>
              {duracion ? <span className={styles.valorSecundario}>({duracion})</span> : null}
            </dd>
          </div>

          <div className={styles.filaDato}>
            <dt className={styles.etiquetaDato}>Cantidad de personas</dt>
            <dd className={styles.valorDato}>{reserva.cantidadPersonas} personas</dd>
          </div>

          <div className={styles.filaDato}>
            <dt className={styles.etiquetaDato}>Motivo</dt>
            <dd className={styles.valorDato}>{reserva.motivo}</dd>
          </div>

          {usuario?.rol === 'admin' || reserva.usuario ? (
            <div className={styles.filaDato}>
              <dt className={styles.etiquetaDato}>Solicitante</dt>
              <dd className={styles.valorDato}>
                <span title={reserva.usuario?.email || nombreSolicitante}>{nombreSolicitante}</span>
              </dd>
            </div>
          ) : null}

          <div className={styles.filaDato}>
            <dt className={styles.etiquetaDato}>Fecha de solicitud</dt>
            <dd className={styles.valorDato}>{formatearFechaHora(reserva.createdAt)}</dd>
          </div>

          {reserva.updatedAt && reserva.updatedAt !== reserva.createdAt ? (
            <div className={styles.filaDato}>
              <dt className={styles.etiquetaDato}>Última actualización</dt>
              <dd className={styles.valorDato}>{formatearFechaHora(reserva.updatedAt)}</dd>
            </div>
          ) : null}
        </dl>

        <AccionesReserva reserva={reserva} usuario={usuario} onAccion={manejarAccionExito} />
      </section>

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
