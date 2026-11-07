import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getResumen } from '../services/reservas.service.js';

const Resumen = () => {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await getResumen();
        setResumen(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Error al cargar el resumen');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  if (cargando) {
    return (
      <div className="loading-state">
        <div className="spinner" style={{ marginBottom: '16px' }}></div>
        <p className="text-secondary">Cargando panel de administración...</p>
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

  if (!resumen) return null;

  const estadoColors = {
    'pendiente': 'badge-pending',
    'aprobada': 'badge-approved',
    'cancelada': 'badge-rejected',
    'rechazada': 'badge-rejected'
  };

  const getEstadoIcon = (estado) => {
    switch(estado) {
      case 'pendiente': return '⏳';
      case 'aprobada': return '✓';
      case 'rechazada':
      case 'cancelada': return '✕';
      default: return '•';
    }
  };

  const totalReservas = resumen.porEstado.reduce((sum, e) => sum + e.total, 0);
  const pendientes = resumen.porEstado.find(e => e.estado === 'pendiente')?.total || 0;
  const aprobadas = resumen.porEstado.find(e => e.estado === 'aprobada')?.total || 0;

  return (
    <div>
      <button onClick={() => navigate('/reservas')} className="back-button">← Volver a mis reservas</button>

      <div className="page-header">
        <div>
          <h1>🛠️ Panel de administración</h1>
          <p className="text-secondary">
            Resumen de reservas, aulas y estadísticas del sistema
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div className="card" style={{
          borderLeft: '4px solid #2563eb'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#9ca3af',
            textTransform: 'uppercase',
            fontWeight: 600,
            margin: '0 0 12px'
          }}>
            Total de reservas
          </p>
          <p style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#2563eb',
            margin: 0
          }}>
            {totalReservas}
          </p>
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '8px 0 0'
          }}>
            en el sistema
          </p>
        </div>

        <div className="card" style={{
          borderLeft: '4px solid #ea580c'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#9ca3af',
            textTransform: 'uppercase',
            fontWeight: 600,
            margin: '0 0 12px'
          }}>
            Pendientes de aprobación
          </p>
          <p style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#ea580c',
            margin: 0
          }}>
            {pendientes}
          </p>
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '8px 0 0'
          }}>
            requieren atención
          </p>
        </div>

        <div className="card" style={{
          borderLeft: '4px solid #16a34a'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#9ca3af',
            textTransform: 'uppercase',
            fontWeight: 600,
            margin: '0 0 12px'
          }}>
            Aprobadas
          </p>
          <p style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#16a34a',
            margin: 0
          }}>
            {aprobadas}
          </p>
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '8px 0 0'
          }}>
            confirmadas
          </p>
        </div>

        <div className="card" style={{
          borderLeft: '4px solid #0284c7'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#9ca3af',
            textTransform: 'uppercase',
            fontWeight: 600,
            margin: '0 0 12px'
          }}>
            Próximas hoy
          </p>
          <p style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#0284c7',
            margin: 0
          }}>
            {resumen.proximasHoy.length}
          </p>
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '8px 0 0'
          }}>
            en las próximas horas
          </p>
        </div>
      </div>

      {/* Distribución por estado */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '16px'
        }}>
          Distribución de reservas
        </h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Cantidad</th>
                <th style={{ textAlign: 'right' }}>Porcentaje</th>
              </tr>
            </thead>
            <tbody>
              {resumen.porEstado.map((e) => {
                const porcentaje = totalReservas > 0 ? ((e.total / totalReservas) * 100).toFixed(1) : 0;
                return (
                  <tr key={e.estado}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{getEstadoIcon(e.estado)}</span>
                        <span className={`badge ${estadoColors[e.estado] || ''}`}>
                          {e.estado.charAt(0).toUpperCase() + e.estado.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {e.total}
                    </td>
                    <td style={{ textAlign: 'right', color: '#6b7280' }}>
                      {porcentaje}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aulas más utilizadas */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '16px'
        }}>
          Aulas más utilizadas
        </h2>
        {resumen.porAula.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <p className="empty-state-description">
              No hay datos de uso de aulas disponibles
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px'
          }}>
            {resumen.porAula.map((a, idx) => (
              <div key={a.aulaId} className="card">
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px'
                }}>
                  <div>
                    <p style={{
                      fontSize: '12px',
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      margin: 0
                    }}>
                      Aula {a.aulaId}
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#111827',
                      margin: '8px 0 0'
                    }}>
                      <strong>{a.total}</strong> reserva{a.total !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div style={{
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    #{idx + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Próximas reservas */}
      <div>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '16px'
        }}>
          Próximas reservas
        </h2>
        {resumen.proximasHoy.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✓</div>
            <p className="empty-state-description">
              No hay próximas reservas programadas
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Aula</th>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {resumen.proximasHoy.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500, color: '#2563eb' }}>
                      #{r.id}
                    </td>
                    <td>
                      Aula {r.aulaId}
                    </td>
                    <td>
                      {new Date(r.fecha).toLocaleDateString('es-AR')}
                    </td>
                    <td style={{ fontSize: '13px', color: '#6b7280' }}>
                      {r.horaInicio} – {r.horaFin}
                    </td>
                    <td>
                      <span className={`badge ${estadoColors[r.estado] || ''}`}>
                        {r.estado.charAt(0).toUpperCase() + r.estado.slice(1)}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => navigate(`/reservas/${r.id}`)}
                        className="btn-ghost btn-small"
                        style={{
                          color: '#2563eb',
                          borderColor: '#2563eb'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.backgroundColor = '#eff6ff';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                        }}
                      >
                        Ver →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Resumen;