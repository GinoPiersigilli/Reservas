const HistorialReserva = ({ historial }) => {
  if (!historial || historial.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '32px', opacity: 0.6 }}>
        <p>Sin historial de cambios</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>Acción</th>
            <th>Usuario ID</th>
            <th>Cambios</th>
          </tr>
        </thead>
        <tbody>
          {historial.map((h) => (
            <tr key={h.id}>
              <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                {new Date(h.fechaHora).toLocaleString('es-AR')}
              </td>
              <td>
                <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{h.accion}</span>
              </td>
              <td style={{ fontSize: '13px', color: 'var(--text-soft)' }}>
                Usuario #{h.usuarioId}
              </td>
              <td>
                <div style={{ fontSize: '12px', color: 'var(--text-soft)' }}>
                  {h.valorAnterior && (
                    <div>
                      <strong>Anterior:</strong> {typeof h.valorAnterior === 'object' ? JSON.stringify(h.valorAnterior) : h.valorAnterior}
                    </div>
                  )}
                  {h.valorNuevo && (
                    <div>
                      <strong>Nuevo:</strong> {typeof h.valorNuevo === 'object' ? JSON.stringify(h.valorNuevo) : h.valorNuevo}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistorialReserva;