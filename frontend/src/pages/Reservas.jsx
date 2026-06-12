import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getReservas } from '../services/reservas.service.js';
import FiltrosReservas from '../components/FiltrosReservas.jsx';
import TablaReservas from '../components/TablaReservas.jsx';

const Reservas = () => {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const [reservas, setReservas] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ fecha: '', estado: '', aulaId: '', q: '' });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargarReservas = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await getReservas({ ...filtros, page: pagina, limit: 10 });
      setReservas(res.data.datos);
      setTotal(res.data.total);
    } catch (err) {
      setError('Error al cargar las reservas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReservas();
  }, [filtros, pagina]);

  const handleFiltros = (nuevosFiltros) => {
    setFiltros(nuevosFiltros);
    setPagina(1);
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '28px' }}>
        <div>
          <h1>Mis reservas</h1>
          <p className="page-sub">
            Bienvenido, <strong>{usuario?.nombre}</strong> {usuario?.rol === 'admin' && '(Administrador)'}
          </p>
        </div>
        <div className="page-actions">
          {usuario?.rol === 'admin' && (
            <Link to="/resumen" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block', padding: '11px 18px' }}>
              📊 Panel resumen
            </Link>
          )}
          <Link to="/reservas/nueva" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', padding: '11px 18px' }}>
            + Nueva reserva
          </Link>
          <button onClick={cerrarSesion} className="btn-ghost">
            Cerrar sesión
          </button>
        </div>
      </div>

      <FiltrosReservas onFiltrar={handleFiltros} />

      {cargando && (
        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
          <div className="loader" style={{ display: 'inline-block', width: '24px', height: '24px' }}></div>
          <p style={{ marginTop: '12px' }}>Cargando reservas...</p>
        </div>
      )}

      {error && <div className="alert alert--error">{error}</div>}

      {!cargando && !error && reservas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
          <p style={{ fontSize: '16px' }}>No hay reservas para mostrar</p>
          <Link to="/reservas/nueva" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block', textDecoration: 'none', padding: '11px 18px' }}>
            Crear tu primera reserva
          </Link>
        </div>
      )}

      {!cargando && !error && reservas.length > 0 && (
        <div className="fade-in">
          <TablaReservas reservas={reservas} onAccion={cargarReservas} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-soft)' }}>
              Total: <strong>{total}</strong> reservas
            </span>
            <div className="row">
              <button 
                disabled={pagina === 1} 
                onClick={() => setPagina(p => p - 1)}
                className="btn-ghost btn-small"
              >
                ← Anterior
              </button>
              <span style={{ fontSize: '14px', color: 'var(--text-soft)', padding: '0 12px' }}>
                Página <strong>{pagina}</strong>
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