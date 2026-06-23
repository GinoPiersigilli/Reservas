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
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="loader" style={{ display: 'inline-block', width: '24px', height: '24px' }}></div>
        <p style={{ marginTop: '12px' }}>Cargando resumen...</p>
      </div>
    );
  }

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!resumen) return null;

  const estadoColors = {
    'pendiente': 'badge--pending',
    'aprobada': 'badge--approved',
    'cancelada': 'badge--rejected',
    'rechazada': 'badge--rejected'
  };

  return (
    <div>
      <button onClick={() => navigate('/reservas')} className="back-button">← Volver</button>

      <div className="page-header">
        <div>
          <h1>Panel de administración</h1>
          <p className="page-sub">Resumen de reservas, aulas y estadísticas</p>
        </div>
      </div>

      <div className="metrics-grid fade-in">
        <div className="metric">
          <div className="value">{resumen.porEstado.reduce((sum, e) => sum + e.total, 0)}</div>
          <div className="label">Reservas totales</div>
        </div>
        <div className="metric">
          <div className="value">{resumen.porEstado.find(e => e.estado === 'pendiente')?.total || 0}</div>
          <div className="label">Pendientes</div>
        </div>
        <div className="metric">
          <div className="value">{resumen.proximasHoy.length}</div>
          <div className="label">Próximas reservas</div>
        </div>
      </div>

      <h2 className="section-title">Reservas por estado</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porEstado.map((e) => (
              <tr key={e.estado}>
                <td>
                  <span className={`badge ${estadoColors[e.estado] || ''}`}>
                    {e.estado}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{e.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Aulas más utilizadas</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Aula ID</th>
              <th style={{ textAlign: 'right' }}>Reservas</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porAula.length === 0 ? (
              <tr>
                <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-soft)' }}>
                  No hay datos disponibles
                </td>
              </tr>
            ) : (
              resumen.porAula.map((a) => (
                <tr key={a.aulaId}>
                  <td style={{ fontWeight: 500 }}>Aula {a.aulaId}</td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>{a.total}</strong> reservas
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Próximas reservas</h2>
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
            {resumen.proximasHoy.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-soft)' }}>
                  No hay próximas reservas
                </td>
              </tr>
            )}
            {resumen.proximasHoy.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>#{r.id}</td>
                <td>{r.aulaId}</td>
                <td>{new Date(r.fecha).toLocaleDateString('es-AR')}</td>
                <td style={{ fontSize: '13px', color: 'var(--text-soft)' }}>
                  {r.horaInicio} - {r.horaFin}
                </td>
                <td>
                  <span className={`badge ${estadoColors[r.estado] || ''}`}>
                    {r.estado}
                  </span>
                </td>
                <td>
                  <button 
                    onClick={() => navigate(`/reservas/${r.id}`)} 
                    className="btn-ghost btn-small"
                  >
                    Ver →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Resumen;