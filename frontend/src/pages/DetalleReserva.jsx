import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getReserva, getHistorial } from '../services/reservas.service.js';
import AccionesReserva from '../components/AccionesReserva.jsx';
import HistorialReserva from '../components/HistorialReserva.jsx';

const DetalleReserva = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [reserva, setReserva] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const [resReserva, resHistorial] = await Promise.all([
        getReserva(id),
        getHistorial(id)
      ]);
      setReserva(resReserva.data);
      setHistorial(resHistorial.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar la reserva');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [id]);

  if (cargando) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="loader" style={{ display: 'inline-block', width: '24px', height: '24px' }}></div>
        <p style={{ marginTop: '12px' }}>Cargando reserva...</p>
      </div>
    );
  }

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!reserva) return null;

  const getEstadoBadge = (estado) => {
    switch(estado) {
      case 'pendiente':
        return 'badge--pending';
      case 'aprobada':
        return 'badge--approved';
      case 'rechazada':
      case 'cancelada':
        return 'badge--rejected';
      default:
        return '';
    }
  };

  return (
    <div>
      <button onClick={() => navigate('/reservas')} className="back-button">← Volver</button>

      <div className="page-header">
        <div>
          <h1>Reserva #{reserva.id}</h1>
          <p className="page-sub">Detalles y historial de cambios</p>
        </div>
        <div>
          <span className={`badge ${getEstadoBadge(reserva.estado)}`} style={{ fontSize: '14px', padding: '8px 16px' }}>
            {reserva.estado.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="card fade-in">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Aula</p>
            <p style={{ fontSize: '18px', fontWeight: 600 }}>{reserva.aulaId}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Fecha</p>
            <p style={{ fontSize: '18px', fontWeight: 600 }}>{new Date(reserva.fecha).toLocaleDateString('es-AR', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Horario</p>
            <p style={{ fontSize: '18px', fontWeight: 600 }}>{reserva.horaInicio} - {reserva.horaFin}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Personas</p>
            <p style={{ fontSize: '18px', fontWeight: 600 }}>{reserva.cantidadPersonas}</p>
          </div>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Motivo</p>
          <p style={{ fontSize: '16px' }}>{reserva.motivo}</p>
        </div>

        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px', color: 'var(--text-soft)' }}>
          <div>
            <strong>Creada:</strong> {new Date(reserva.createdAt).toLocaleString('es-AR')}
          </div>
          {reserva.updatedAt && (
            <div>
              <strong>Última actualización:</strong> {new Date(reserva.updatedAt).toLocaleString('es-AR')}
            </div>
          )}
        </div>
      </div>

      <AccionesReserva reserva={reserva} usuario={usuario} onAccion={cargarDatos} />

      {historial.length > 0 && (
        <>
          <h2 className="section-title">Historial de cambios</h2>
          <HistorialReserva historial={historial} />
        </>
      )}
    </div>
  );
};

export default DetalleReserva;