import { useState, useEffect, useCallback } from 'react';
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

  const cargarDatos = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  if (cargando) {
    return (
      <div className="loading-state">
        <div className="spinner" style={{ marginBottom: '16px' }}></div>
        <p className="text-secondary">Cargando reserva...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button onClick={() => navigate('/reservas')} className="back-button">← Volver</button>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (!reserva) return null;

  const getEstadoBadge = (estado) => {
    const map = {
      'pendiente': 'badge-pending',
      'aprobada': 'badge-approved',
      'rechazada': 'badge-rejected',
      'cancelada': 'badge-rejected'
    };
    return map[estado] || '';
  };

  const estadoLabels = {
    'pendiente': 'Pendiente',
    'aprobada': 'Aprobada',
    'rechazada': 'Rechazada',
    'cancelada': 'Cancelada'
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div>
      <button onClick={() => navigate('/reservas')} className="back-button">← Volver a mis reservas</button>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Reserva #{reserva.id}</h1>
          <p className="text-secondary">
            Detalles y historial de cambios
          </p>
        </div>
        <div>
          <span className={`badge ${getEstadoBadge(reserva.estado)}`} style={{ fontSize: '13px', padding: '6px 12px' }}>
            {estadoLabels[reserva.estado] || reserva.estado}
          </span>
        </div>
      </div>

      {/* Información Principal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '24px'
      }}>
        {/* Card Izquierda - Detalles */}
        <div className="card fade-in">
          <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '16px' }}>
            Información de la reserva
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Aula */}
            <div>
              <p style={{
                fontSize: '11px',
                color: '#9ca3af',
                textTransform: 'uppercase',
                fontWeight: 600,
                margin: '0 0 8px'
              }}>
                Aula
              </p>
              <p style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#111827',
                margin: 0
              }}>
                Aula {reserva.aulaId}
              </p>
            </div>

            {/* Fecha */}
            <div>
              <p style={{
                fontSize: '11px',
                color: '#9ca3af',
                textTransform: 'uppercase',
                fontWeight: 600,
                margin: '0 0 8px'
              }}>
                Fecha
              </p>
              <p style={{
                fontSize: '15px',
                fontWeight: 500,
                color: '#111827',
                margin: 0
              }}>
                {formatearFecha(reserva.fecha)}
              </p>
            </div>

            {/* Horario */}
            <div>
              <p style={{
                fontSize: '11px',
                color: '#9ca3af',
                textTransform: 'uppercase',
                fontWeight: 600,
                margin: '0 0 8px'
              }}>
                Horario
              </p>
              <p style={{
                fontSize: '15px',
                fontWeight: 500,
                color: '#111827',
                margin: 0
              }}>
                {reserva.horaInicio} – {reserva.horaFin}
              </p>
              <p style={{
                fontSize: '12px',
                color: '#6b7280',
                margin: '4px 0 0'
              }}>
                Duración: {(() => {
                  const [h1, m1] = reserva.horaInicio.split(':').map(Number);
                  const [h2, m2] = reserva.horaFin.split(':').map(Number);
                  const mins = (h2 - h1) * 60 + (m2 - m1);
                  return `${mins} minutos`;
                })()}
              </p>
            </div>

            {/* Personas */}
            <div>
              <p style={{
                fontSize: '11px',
                color: '#9ca3af',
                textTransform: 'uppercase',
                fontWeight: 600,
                margin: '0 0 8px'
              }}>
                Cantidad de personas
              </p>
              <p style={{
                fontSize: '15px',
                fontWeight: 500,
                color: '#111827',
                margin: 0
              }}>
                {reserva.cantidadPersonas} personas
              </p>
            </div>

            {/* Motivo */}
            <div>
              <p style={{
                fontSize: '11px',
                color: '#9ca3af',
                textTransform: 'uppercase',
                fontWeight: 600,
                margin: '0 0 8px'
              }}>
                Motivo
              </p>
              <p style={{
                fontSize: '14px',
                color: '#111827',
                margin: 0,
                lineHeight: '1.5'
              }}>
                {reserva.motivo}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{
            margin: '24px 0',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb'
          }}>
            {/* Fechas de auditoría */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              fontSize: '12px',
              color: '#6b7280'
            }}>
              <div>
                <p style={{ fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                  Creada
                </p>
                <p style={{ margin: 0 }}>
                  {new Date(reserva.createdAt).toLocaleString('es-AR')}
                </p>
              </div>
              {reserva.updatedAt && reserva.updatedAt !== reserva.createdAt && (
                <div>
                  <p style={{ fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                    Última actualización
                  </p>
                  <p style={{ margin: 0 }}>
                    {new Date(reserva.updatedAt).toLocaleString('es-AR')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Derecha - Acciones */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div>
            <AccionesReserva reserva={reserva} usuario={usuario} onAccion={cargarDatos} />
          </div>
        </div>
      </div>

      {/* Historial de cambios */}
      {historial.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '16px'
          }}>
            Historial de cambios
          </h2>
          <HistorialReserva historial={historial} />
        </div>
      )}
    </div>
  );
};

export default DetalleReserva;