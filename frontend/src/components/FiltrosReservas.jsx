import { useState } from 'react';

const FiltrosReservas = ({ onFiltrar }) => {
  const [form, setForm] = useState({ fecha: '', estado: '', aulaId: '', q: '' });

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

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div className="form-row">
          <label htmlFor="fecha">Fecha</label>
          <input
            id="fecha"
            type="date"
            name="fecha"
            value={form.fecha}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <label htmlFor="estado">Estado</label>
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

        <div className="form-row">
          <label htmlFor="aulaId">ID de aula</label>
          <input
            id="aulaId"
            type="number"
            name="aulaId"
            value={form.aulaId}
            onChange={handleChange}
            placeholder="Ej: 101"
          />
        </div>

        <div className="form-row">
          <label htmlFor="q">Buscar por motivo</label>
          <input
            id="q"
            type="text"
            name="q"
            value={form.q}
            onChange={handleChange}
            placeholder="Ej: Reunión"
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>
            Filtrar
          </button>
          <button type="button" onClick={handleLimpiar} className="btn-ghost" style={{ flex: 1 }}>
            Limpiar
          </button>
        </div>
      </form>
    </div>
  );
};

export default FiltrosReservas;