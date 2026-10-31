import { useState } from 'react';

const FiltrosReservas = ({ onFiltrar }) => {
  const [form, setForm] = useState({ fecha: '', estado: '', aulaId: '', q: '' });
  const [expandido, setExpandido] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onFiltrar(form);
  };

  const handleLimpiar = () => {
    const vacio = { fecha: '', estado: '', aulaId: '', q: '' };
    setForm(vacio);
    onFiltrar(vacio);
  };

  const tieneFiltros = Object.values(form).some(v => v !== '');

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <form onSubmit={handleSubmit}>
        {/* Filter Header / Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: expandido ? '16px' : 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              🔍 Filtros
            </span>
            {tieneFiltros && (
              <span style={{
                display: 'inline-block',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 600
              }}>
                Activos
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'color 150ms'
            }}
            onMouseOver={(e) => e.target.style.color = '#111827'}
            onMouseOut={(e) => e.target.style.color = '#6b7280'}
          >
            {expandido ? '▼ Ocultar' : '▶ Mostrar'}
          </button>
        </div>

        {/* Filter Fields - Expandible */}
        {expandido && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid #f3f4f6'
          }}>
            <div>
              <label htmlFor="fecha" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#111827',
                marginBottom: '6px'
              }}>
                Fecha
              </label>
              <input
                id="fecha"
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="estado" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#111827',
                marginBottom: '6px'
              }}>
                Estado
              </label>
              <select 
                id="estado"
                name="estado" 
                value={form.estado} 
                onChange={handleChange}
              >
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="aprobada">Aprobada</option>
                <option value="cancelada">Cancelada</option>
                <option value="rechazada">Rechazada</option>
              </select>
            </div>

            <div>
              <label htmlFor="aulaId" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#111827',
                marginBottom: '6px'
              }}>
                ID de aula
              </label>
              <input
                id="aulaId"
                type="number"
                name="aulaId"
                value={form.aulaId}
                onChange={handleChange}
                placeholder="Ej: 101"
              />
            </div>

            <div>
              <label htmlFor="q" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#111827',
                marginBottom: '6px'
              }}>
                Buscar por motivo
              </label>
              <input
                id="q"
                type="text"
                name="q"
                value={form.q}
                onChange={handleChange}
                placeholder="Ej: Reunión"
              />
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end'
            }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                Filtrar
              </button>
              <button 
                type="button" 
                onClick={handleLimpiar} 
                className="btn-ghost" 
                style={{ flex: 1 }}
              >
                Limpiar
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default FiltrosReservas;