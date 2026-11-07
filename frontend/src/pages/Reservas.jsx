import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import {
  Button,
  EmptyState,
  ErrorState,
  TablaSkeleton
} from '../components/ui/index.js';
import FiltrosReservas from '../components/FiltrosReservas.jsx';
import TablaReservas from '../components/TablaReservas.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getAulas } from '../services/aula.service.js';
import { getReservas } from '../services/reservas.service.js';
import { TEXTOS } from '../textos.js';
import styles from './Reservas.module.css';

const POR_PAGINA = 10;

export default function Reservas() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const esAdmin = usuario?.rol === 'admin';

  const [reservas, setReservas] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ fecha: '', estado: '', aulaId: '', q: '' });
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState('DESC');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    Promise.resolve(typeof getAulas === 'function' ? getAulas() : null)
      .then((res) => {
        if (!cancelado && Array.isArray(res?.data)) {
          setAulas(res.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  const mapaAulas = useMemo(() => {
    const mapa = {};
    aulas.forEach((aula) => {
      mapa[aula.id] = aula.nombre;
    });
    return mapa;
  }, [aulas]);

  const cargarReservas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await getReservas({
        ...filtros,
        page: pagina,
        limit: POR_PAGINA,
        sortBy,
        order
      });
      setReservas(res.data.datos);
      setTotal(res.data.total);
    } catch {
      setError(TEXTOS.reservas.errorDescripcion);
    } finally {
      setCargando(false);
    }
  }, [filtros, pagina, sortBy, order]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarReservas();
  }, [cargarReservas]);

  const handleFiltros = (nuevosFiltros) => {
    setFiltros(nuevosFiltros);
    setPagina(1);
  };

  const handleOrdenar = (campo) => {
    if (sortBy === campo) {
      setOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(campo);
      setOrder('ASC');
    }
    setPagina(1);
  };

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(total, (pagina - 1) * POR_PAGINA + reservas.length);

  const cabecerasSkeleton = esAdmin
    ? ['#', 'Aula', 'Fecha', 'Horario', 'Solicitante', 'Motivo', 'Estado', '']
    : ['#', 'Aula', 'Fecha', 'Horario', 'Motivo', 'Estado', ''];

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <h1>
          {esAdmin ? TEXTOS.reservas.tituloAdmin : TEXTOS.reservas.tituloUsuario}
        </h1>
        <Button
          variante="primario"
          icono={CalendarPlus}
          onClick={() => navigate('/reservas/nueva')}
        >
          {TEXTOS.navegacion.nuevaReserva}
        </Button>
      </header>

      <FiltrosReservas onFiltrar={handleFiltros} aulas={aulas} />

      {cargando ? (
        <TablaSkeleton filas={5} cabeceras={cabecerasSkeleton} />
      ) : null}

      {!cargando && error ? (
        <ErrorState
          titulo={TEXTOS.reservas.errorTitulo}
          descripcion={error}
          onReintentar={cargarReservas}
        />
      ) : null}

      {!cargando && !error && reservas.length === 0 ? (
        <EmptyState
          titulo={TEXTOS.reservas.vacioTitulo}
          descripcion={TEXTOS.reservas.vacioDescripcion}
          accion={
            <Button
              variante="primario"
              icono={CalendarPlus}
              onClick={() => navigate('/reservas/nueva')}
            >
              {TEXTOS.acciones.reservarAula}
            </Button>
          }
        />
      ) : null}

      {!cargando && !error && reservas.length > 0 ? (
        <>
          <TablaReservas
            reservas={reservas}
            esAdmin={esAdmin}
            mapaAulas={mapaAulas}
            sortBy={sortBy}
            order={order}
            onOrdenar={handleOrdenar}
          />

          <nav className={styles.paginacion} aria-label="Paginación de reservas">
            <span className={styles.resumenPaginacion}>
              Mostrando {desde}–{hasta} de {total}
            </span>

            <div className={styles.controlesPaginacion}>
              <Button
                variante="secundario"
                tamano="sm"
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                {TEXTOS.acciones.anterior}
              </Button>

              {Array.from({ length: totalPaginas }).map((_, idx) => {
                const num = idx + 1;
                const esActiva = num === pagina;
                return (
                  <button
                    key={num}
                    type="button"
                    aria-current={esActiva ? 'page' : undefined}
                    className={[
                      styles.botonPagina,
                      esActiva ? styles.botonPaginaActivo : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setPagina(num)}
                  >
                    {num}
                  </button>
                );
              })}

              <Button
                variante="secundario"
                tamano="sm"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                {TEXTOS.acciones.siguiente}
              </Button>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
