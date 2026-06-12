import { useNavigate } from 'react-router-dom';

const TablaReservas = ({ reservas }) => {
  const navigate = useNavigate();

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
              <td style={{ fontWeight: 500 }}>#{r.id}</td>
              <td>{r.aulaId}</td>
              <td>{new Date(r.fecha).toLocaleDateString('es-AR')}</td>
              <td style={{ fontSize: '13px', color: 'var(--text-soft)' }}>
                {r.horaInicio} - {r.horaFin}
              </td>
              <td>{r.motivo}</td>
              <td>
                <span className={`badge ${getEstadoBadge(r.estado)}`}>
                  {r.estado}
                </span>
              </td>
              <td>
                <button 
                  onClick={() => navigate(`/reservas/${r.id}`)} 
                  className="btn-ghost btn-small"
                >
                  Ver detalle →
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