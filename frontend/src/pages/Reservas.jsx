import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getReservas } from '../services/reservas.service.js';
import FiltrosReservas from '../components/FiltrosReservas.jsx';
import TablaReservas from '../components/TablaReservas.jsx';

const Reservas = () => {
  const { usuario, cerrarSesion } = useAuth();

  const [reservas, setReservas] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ fecha: '', estado: '', aulaId: '', q: '' });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargarReservas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await getReservas({ ...filtros, page: pagina, limit: 10 });
      setReservas(res.data.datos);
      setTotal(res.data.total);
    } catch {
      setError('Error al cargar las reservas');
    } finally {
      setCargando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarReservas();
  }, [cargarReservas]);

  const handleFiltros = (nuevosFiltros) => {
    setFiltros(nuevosFiltros);
    setPagina(1);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Mis reservas</h1>
          <p className="text-secondary">
            Bienvenido, <strong>{usuario?.nombre}</strong>
            {usuario?.rol === 'admin' && ' • Administrador'}
          </p>
        </div>
        <div className="page-actions">
          {usuario?.rol === 'admin' && (
            <Link 
              to="/resumen" 
              className="btn-secondary" 
              style={{ textDecoration: 'none', display: 'inline-block' }}
            >
              Panel de resumen
            </Link>
          )}
          <Link 
            to="/reservas/nueva" 
            className="btn-primary" 
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            + Nueva reserva
          </Link>
          <button onClick={cerrarSesion} className="btn-ghost">
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Filters */}
      <FiltrosReservas onFiltrar={handleFiltros} />

      {/* Loading State */}
      {cargando && (
        <div className="loading-state">
          <div className="spinner" style={{ marginBottom: '16px' }}></div>
          <p className="text-secondary">Cargando reservas...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!cargando && !error && reservas.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3 className="empty-state-title">No hay reservas</h3>
          <p className="empty-state-description">
            Todavía no tienes ninguna reserva. Crea una nueva para comenzar.
          </p>
          <Link 
            to="/reservas/nueva" 
            className="btn-primary" 
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            Crear mi primera reserva
          </Link>
        </div>
      )}

      {/* Reservations List/Table */}
      {!cargando && !error && reservas.length > 0 && (
        <div className="fade-in">
          <TablaReservas reservas={reservas} onAccion={cargarReservas} />
          
          {/* Pagination */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}>
            <span className="text-secondary" style={{ fontSize: '13px' }}>
              Mostrando <strong>{reservas.length}</strong> de <strong>{total}</strong> reservas
            </span>
            <div className="flex" style={{ gap: '8px' }}>
              <button 
                disabled={pagina === 1} 
                onClick={() => setPagina(p => p - 1)}
                className="btn-ghost btn-small"
              >
                ← Anterior
              </button>
              <span className="text-secondary" style={{ fontSize: '13px', padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                Página <strong style={{ marginLeft: '4px', marginRight: '4px' }}>{pagina}</strong>
              </span>
              <button 
                disabled={pagina * 10 >= total} 
                onClick={() => setPagina(p => p + 1)}
                className="btn-ghost btn-small"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservas;