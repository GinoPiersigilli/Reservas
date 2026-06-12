import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aprobarReserva, rechazarReserva, cancelarReserva } from '../services/reservas.service.js';

const AccionesReserva = ({ reserva, usuario, onAccion }) => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const esAdmin = usuario?.rol === 'admin';
  const esPropietario = usuario?.id === reserva.usuarioId;
  const { estado } = reserva;

  const ejecutar = async (accion) => {
    setCargando(true);
    setError(null);
    try {
      await accion();
      onAccion();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al ejecutar la acción');
    } finally {
      setCargando(false);
    }
  };

  const puedeAprobar  = esAdmin && estado === 'pendiente';
  const puedeRechazar = esAdmin && estado === 'pendiente';
  const puedeEditar   = esAdmin && (estado === 'pendiente' || estado === 'aprobada');
  const puedeCancelar = (esAdmin || esPropietario) && (estado === 'pendiente' || estado === 'aprobada');

  if (!puedeAprobar && !puedeRechazar && !puedeEditar && !puedeCancelar) {
    return null;
  }

  return (
    <div className="card" style={{ marginTop: '24px', borderColor: 'rgba(59,130,246,0.2)' }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>Acciones disponibles</h3>
      
      {error && <div className="alert alert--error" style={{ marginBottom: '16px' }}>{error}</div>}
      
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {puedeAprobar && (
          <button 
            disabled={cargando} 
            onClick={() => ejecutar(() => aprobarReserva(reserva.id))}
            className="btn-secondary"
          >
            ✓ Aprobar
          </button>
        )}
        
        {puedeRechazar && (
          <button 
            disabled={cargando} 
            onClick={() => ejecutar(() => rechazarReserva(reserva.id))}
            className="btn-danger"
          >
            ✗ Rechazar
          </button>
        )}
        
        {puedeEditar && (
          <button 
            disabled={cargando} 
            onClick={() => navigate(`/reservas/${reserva.id}/editar`)}
            className="btn-ghost"
          >
            ✎ Editar
          </button>
        )}
        
        {puedeCancelar && (
          <button 
            disabled={cargando} 
            onClick={() => ejecutar(() => cancelarReserva(reserva.id))}
            className="btn-danger"
          >
            ✕ Cancelar
          </button>
        )}
      </div>
    </div>
  );
};

export default AccionesReserva;