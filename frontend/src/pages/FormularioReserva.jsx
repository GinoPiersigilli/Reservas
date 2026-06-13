import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReserva, crearReserva, editarReserva } from '../services/reservas.service.js';
import { getAulas } from '../services/aula.service.js';

const FormularioReserva = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const esEdicion = Boolean(id);

  const [form, setForm] = useState({
    aulaId: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    cantidadPersonas: '',
    motivo: ''
  });
  const [aulas, setAulas] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const cargarAulas = async () => {
      try {
        const res = await getAulas();
        setAulas(res.data.filter(a => a.activa));
      } catch {
        setError('Error al cargar las aulas');
      }
    };
    cargarAulas();

    if (esEdicion) {
      const cargarReserva = async () => {
        try {
          const res = await getReserva(id);
          const r = res.data;
          setForm({
            aulaId: r.aulaId,
            fecha: r.fecha,
            horaInicio: r.horaInicio,
            horaFin: r.horaFin,
            cantidadPersonas: r.cantidadPersonas,
            motivo: r.motivo
          });
        } catch {
          setError('Error al cargar la reserva');
        }
      };
      cargarReserva();
    }
  }, [id]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.horaInicio >= form.horaFin) {
      setError('La hora de inicio debe ser menor a la hora de fin');
      return;
    }
    if (form.horaInicio < '08:00' || form.horaFin > '22:00') {
      setError('Las reservas solo se permiten entre las 08:00 y las 22:00');
      return;
    }

    setCargando(true);
    try {
      if (esEdicion) {
        await editarReserva(id, form);
        navigate(`/reservas/${id}`);
      } else {
        const res = await crearReserva(form);
        navigate(`/reservas/${res.data.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la reserva');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <button onClick={() => navigate(-1)} className="back-button">← Volver</button>
      
      <div className="page-header">
        <div>
          <h1>{esEdicion ? 'Editar reserva' : 'Nueva reserva'}</h1>
          <p className="page-sub">
            {esEdicion ? 'Actualiza los detalles de tu reserva' : 'Crea una nueva reserva en el aula'}
          </p>
        </div>
      </div>

      <div className="card fade-in">
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-row">
            <label htmlFor="aulaId">Aula *</label>
            <select 
              name="aulaId" 
              value={form.aulaId} 
              onChange={handleChange} 
            required
            style={{
            width: '100%',
            padding: '10px 14px',
            backgroundColor: '#1E293B',
            color: '#F8FAFC',
            border: '1px solid #334155',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 14px center'
  }}
>
  <option value="" style={{ backgroundColor: '#1E293B' }}>Seleccioná un aula</option>
  {aulas.map(a => (
    <option key={a.id} value={a.id} style={{ backgroundColor: '#1E293B' }}>
      {a.nombre} — {a.ubicacion} (cap. {a.capacidad})
    </option>
  ))}
</select>
          </div>

          <div className="form-row">
            <label htmlFor="fecha">Fecha *</label>
            <input 
              id="fecha"
              type="date" 
              name="fecha" 
              value={form.fecha} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="form-row">
            <label htmlFor="horaInicio">Hora de inicio *</label>
            <input 
              id="horaInicio"
              type="time" 
              name="horaInicio" 
              value={form.horaInicio} 
              onChange={handleChange} 
              required 
              min="08:00"
              max="22:00"
            />
          </div>

          <div className="form-row">
            <label htmlFor="horaFin">Hora de fin *</label>
            <input 
              id="horaFin"
              type="time" 
              name="horaFin" 
              value={form.horaFin} 
              onChange={handleChange} 
              required 
              min="08:00"
              max="22:00"
            />
          </div>

          <div className="form-row">
            <label htmlFor="cantidadPersonas">Cantidad de personas *</label>
            <input 
              id="cantidadPersonas"
              type="number" 
              name="cantidadPersonas" 
              value={form.cantidadPersonas} 
              onChange={handleChange} 
              required 
              min="1" 
            />
          </div>

          <div className="form-row">
            <label htmlFor="motivo">Motivo de la reserva *</label>
            <input 
              id="motivo"
              type="text" 
              name="motivo" 
              placeholder="Ej: Reunión de proyecto"
              value={form.motivo} 
              onChange={handleChange} 
              required 
            />
          </div>

          {error && <div className="alert alert--error" style={{ gridColumn: '1 / -1' }}>{error}</div>}

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="submit" className="btn-primary" disabled={cargando}>
              {cargando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear reserva'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormularioReserva;