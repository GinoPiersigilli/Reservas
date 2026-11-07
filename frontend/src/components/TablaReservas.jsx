import { useNavigate } from 'react-router-dom';

const TablaReservas = ({ reservas }) => {
  const navigate = useNavigate();

  const getEstadoBadge = (estado) => {
    const map = {
      'pendiente': 'badge-pending',
      'aprobada': 'badge-approved',
      'rechazada': 'badge-rejected',
      'cancelada': 'badge-rejected'
    };
    return map[estado] || '';
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const estadoLabels = {
    'pendiente': 'Pendiente',
    'aprobada': 'Aprobada',
    'rechazada': 'Rechazada',
    'cancelada': 'Cancelada'
  };

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Aula</th>
            <th>Fecha</th>
            <th>Horario</th>
            <th>Motivo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reservas.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500, color: '#2563eb' }}>
                #{r.id}
              </td>
              <td>
                Aula {r.aulaId}
              </td>
              <td>
                {formatearFecha(r.fecha)}
              </td>
              <td style={{ fontSize: '13px', color: '#6b7280' }}>
                {r.horaInicio} - {r.horaFin}
              </td>
              <td>
                {r.motivo}
              </td>
              <td>
                <span className={`badge ${getEstadoBadge(r.estado)}`}>
                  {estadoLabels[r.estado] || r.estado}
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
  );
};

export default TablaReservas;