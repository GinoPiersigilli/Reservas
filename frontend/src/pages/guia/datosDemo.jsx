import { EstadoBadge } from '../../components/ui/index.js';

/** Datos ficticios para mostrar los componentes de la guía de estilos. */
export const COLUMNAS_DEMO = [
  { key: 'id', titulo: '#', render: (fila) => `#${fila.id}` },
  { key: 'aula', titulo: 'Aula' },
  { key: 'fecha', titulo: 'Fecha' },
  { key: 'horario', titulo: 'Horario' },
  { key: 'motivo', titulo: 'Motivo' },
  {
    key: 'estado',
    titulo: 'Estado',
    render: (fila) => <EstadoBadge estado={fila.estado} />
  }
];

export const DATOS_DEMO = [
  {
    id: 25,
    aula: 'Aula 910',
    fecha: '12/11/2026',
    horario: '10:00–12:00',
    motivo: 'Parcial de Física II',
    estado: 'pendiente'
  },
  {
    id: 24,
    aula: 'Laboratorio A6',
    fecha: '12/11/2026',
    horario: '14:00–16:00',
    motivo: 'Práctica de cátedra',
    estado: 'aprobada'
  },
  {
    id: 23,
    aula: 'Aula Magna',
    fecha: '10/11/2026',
    horario: '08:00–10:00',
    motivo: 'Jornada departamental',
    estado: 'rechazada'
  },
  {
    id: 22,
    aula: 'Sala de Reuniones B',
    fecha: '09/11/2026',
    horario: '16:00–18:00',
    motivo: 'Reunión de coordinación',
    estado: 'cancelada'
  }
];

export const OPCIONES_AULAS = [
  { value: '1', label: 'Aula 910 (cap. 45)' },
  { value: '2', label: 'Laboratorio A6 (cap. 30)' },
  { value: '3', label: 'Aula Magna (cap. 150)' }
];
