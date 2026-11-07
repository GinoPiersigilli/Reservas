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
  const [aulaCargando, setAulaCargando] = useState(true);

  useEffect(() => {
    const cargarAulas = async () => {
      try {
        const res = await getAulas();
        setAulas(res.data.filter(a => a.activa));
      } catch {
        setError('Error al cargar las aulas');
      } finally {
        setAulaCargando(false);
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
  }, [id, esEdicion]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validar = () => {
    if (!form.aulaId) {
      setError('Debes seleccionar un aula');
      return false;
    }
    if (!form.fecha) {
      setError('Debes seleccionar una fecha');
      return false;
    }
    if (!form.horaInicio || !form.horaFin) {
      setError('Debes especificar horario de inicio y fin');
      return false;
    }
    if (form.horaInicio >= form.horaFin) {
      setError('La hora de inicio debe ser menor que la hora de fin');
      return false;
    }
    if (form.horaInicio < '08:00' || form.horaFin > '22:00') {
      setError('Las reservas solo se permiten entre las 08:00 y las 22:00');
      return false;
    }
    if (!form.cantidadPersonas || form.cantidadPersonas < 1) {
      setError('Debes indicar al menos una persona');
      return false;
    }
    if (!form.motivo.trim()) {
      setError('Debes especificar un motivo para la reserva');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validar()) return;

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
      // Manejo de errores específicos del backend
      const errorMsg = err.response?.data?.error || '';
      if (errorMsg.includes('capacidad')) {
        setError('La cantidad de personas excede la capacidad del aula');
      } else if (errorMsg.includes('superposición') || errorMsg.includes('ocupada') || errorMsg.includes('reservada')) {
        setError('El horario solicitado no está disponible. El aula ya tiene una reserva en ese período');
      } else if (errorMsg.includes('pasada')) {
        setError('No puedes reservar para una fecha pasada');
      } else {
        setError('Ocurrió un error al guardar la reserva. Intenta nuevamente');
      }
    } finally {
      setCargando(false);
    }
  };

  const aulaSeleccionada = aulas.find(a => a.id == form.aulaId);

  return (
    <div>
      <button onClick={() => navigate(-1)} className="back-button">← Volver</button>
      
      <div className="page-header">
        <div>
          <h1>{esEdicion ? 'Editar reserva' : 'Nueva reserva'}</h1>
          <p className="text-secondary">
            {esEdicion 
              ? 'Modifica los detalles de tu reserva' 
              : 'Completa el formulario para reservar un aula'}
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px'
      }}>
        {/* Formulario */}
        <div className="card fade-in">
          <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '16px' }}>
            {esEdicion ? 'Editar detalles' : 'Información de la reserva'}
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Aula */}
            <div>
              <label htmlFor="aulaId" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#111827',
                marginBottom: '6px'
              }}>
                Aula<span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select 
                id="aulaId"
                name="aulaId" 
                value={form.aulaId} 
                onChange={handleChange}
                disabled={aulaCargando}
                required
              >
                <option value="">
                  {aulaCargando ? 'Cargando aulas...' : 'Selecciona un aula'}
                </option>
                {aulas.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} – {a.ubicacion} (cap. {a.capacidad})
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label htmlFor="fecha" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#111827',
                marginBottom: '6px'
              }}>
                Fecha<span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input 
                id="fecha"
                type="date" 
                name="fecha" 
                value={form.fecha} 
                onChange={handleChange}
                required
              />
            </div>

            {/* Horarios */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="horaInicio" style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#111827',
                  marginBottom: '6px'
                }}>
                  Hora de inicio<span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input 
                  id="horaInicio"
                  type="time" 
                  name="horaInicio" 
                  value={form.horaInicio} 
                  onChange={handleChange}
                  min="08:00"
                  max="22:00"
                  required
                />
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' }}>
                  Desde las 08:00
                </p>
              </div>

              <div>
                <label htmlFor="horaFin" style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#111827',
                  marginBottom: '6px'
                }}>
                  Hora de fin<span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input 
                  id="horaFin"
                  type="time" 
                  name="horaFin" 
                  value={form.horaFin} 
                  onChange={handleChange}
                  min="08:00"
                  max="22:00"
                  required
                />
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' }}>
                  Hasta las 22:00
                </p>
              </div>
            </div>

            {/* Cantidad de personas */}
            <div>
              <label htmlFor="cantidadPersonas" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#111827',
                marginBottom: '6px'
              }}>
                Cantidad de personas<span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input 
                id="cantidadPersonas"
                type="number" 
                name="cantidadPersonas" 
                value={form.cantidadPersonas} 
                onChange={handleChange}
                min="1"
                required
              />
              {aulaSeleccionada && (
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' }}>
                  Capacidad: hasta {aulaSeleccionada.capacidad} personas
                </p>
              )}
            </div>

            {/* Motivo */}
            <div>
              <label htmlFor="motivo" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#111827',
                marginBottom: '6px'
              }}>
                Motivo<span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input 
                id="motivo"
                type="text" 
                name="motivo" 
                placeholder="Ej: Reunión de proyecto, Clase"
                value={form.motivo} 
                onChange={handleChange}
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            {/* Botones */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={cargando}
                style={{ flex: 1 }}
              >
                {cargando ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Crear reserva'}
              </button>
              <button 
                type="button" 
                onClick={() => navigate(-1)} 
                className="btn-ghost"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>

        {/* Resumen (lado derecho) */}
        {(form.aulaId || form.fecha || form.horaInicio) && (
          <div className="card" style={{ height: 'fit-content' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>
              Resumen
            </h3>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px'
            }}>
              {aulaSeleccionada && (
                <div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 4px' }}>
                    Aula
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                    {aulaSeleccionada.nombre}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                    {aulaSeleccionada.ubicacion}
                  </p>
                </div>
              )}

              {form.fecha && (
                <div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 4px' }}>
                    Fecha
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                    {new Date(form.fecha).toLocaleDateString('es-AR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}

              {form.horaInicio && form.horaFin && (
                <div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 4px' }}>
                    Horario
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                    {form.horaInicio} – {form.horaFin}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                    {(() => {
                      const start = form.horaInicio.split(':');
                      const end = form.horaFin.split(':');
                      const duracion = (parseInt(end[0]) - parseInt(start[0])) * 60 + 
                                     (parseInt(end[1]) - parseInt(start[1]));
                      return `Duración: ${duracion} minutos`;
                    })()}
                  </p>
                </div>
              )}

              {form.cantidadPersonas && (
                <div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 4px' }}>
                    Personas
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                    {form.cantidadPersonas}
                  </p>
                </div>
              )}

              {form.motivo && (
                <div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 4px' }}>
                    Motivo
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                    {form.motivo}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormularioReserva;