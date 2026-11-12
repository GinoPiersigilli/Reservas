import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Resumen from '../Resumen.jsx';
import * as reservasService from '../../services/reservas.service.js';

vi.mock('../../services/aula.service.js', () => ({
  getAulas: vi.fn().mockResolvedValue({ data: [] })
}));

vi.mock('../../services/reservas.service.js', () => ({
  getResumen: vi.fn(),
  getReservas: vi.fn(),
  aprobarReserva: vi.fn(),
  rechazarReserva: vi.fn()
}));

const resumenMock = {
  porEstado: [
    { estado: 'aprobada', total: 14 },
    { estado: 'pendiente', total: 2 },
    { estado: 'rechazada', total: 3 },
    { estado: 'cancelada', total: 1 }
  ],
  porAula: [
    { aulaId: 101, total: 9 },
    { aulaId: 204, total: 5 }
  ],
  proximasHoy: [
    {
      id: 30,
      aulaId: 101,
      fecha: '2026-11-07',
      horaInicio: '10:00',
      horaFin: '12:00',
      motivo: 'Clase de consulta',
      estado: 'aprobada'
    }
  ],
  distribucionEstados: [
    { estado: 'aprobada', cantidad: 14, porcentaje: 70 },
    { estado: 'pendiente', cantidad: 2, porcentaje: 10 },
    { estado: 'rechazada', cantidad: 3, porcentaje: 15 },
    { estado: 'cancelada', cantidad: 1, porcentaje: 5 }
  ],
  tasaOcupacionAulas: [
    {
      aulaId: 101,
      nombre: 'Aula 101',
      capacidad: 30,
      ubicacion: 'Planta Baja',
      horasOcupadas: 18.5,
      horasDisponibles: 420,
      tasaOcupacion: 45
    }
  ],
  aulasMayorDemanda: [
    {
      aulaId: 101,
      nombre: 'Aula 101',
      capacidad: 30,
      horasOcupadas: 18.5,
      totalReservas: 9
    }
  ],
  totalReservas: 20
};

const pendientesMock = [
  {
    id: 24,
    aulaId: 204,
    usuarioId: 5,
    usuario: { nombre: 'M. Gómez' },
    fecha: '2026-11-12',
    horaInicio: '14:00',
    horaFin: '16:00',
    estado: 'pendiente'
  },
  {
    id: 25,
    aulaId: 101,
    usuarioId: 6,
    usuario: { nombre: 'L. Pérez' },
    fecha: '2026-11-13',
    horaInicio: '08:00',
    horaFin: '10:00',
    estado: 'pendiente'
  }
];

describe('Resumen (Panel de administración)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reservasService.getResumen.mockResolvedValue({ data: resumenMock });
    reservasService.getReservas.mockResolvedValue({
      data: { data: pendientesMock }
    });
  });

  it('renders the pending approval queue first and allows approving/rejecting with confirmation', async () => {
    reservasService.aprobarReserva.mockResolvedValueOnce({ data: { id: 24, estado: 'aprobada' } });

    render(
      <MemoryRouter>
        <Resumen />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('heading', { name: /Pendientes de aprobación \(2\)/i })
    ).toBeInTheDocument();

    const tablaPendientes = screen.getByRole('table', {
      name: /Cola de reservas pendientes de aprobación/i
    });
    expect(within(tablaPendientes).getByText('#24')).toBeInTheDocument();
    expect(within(tablaPendientes).getByText('M. Gómez')).toBeInTheDocument();
    expect(within(tablaPendientes).getByText('#25')).toBeInTheDocument();
    expect(within(tablaPendientes).getByText('L. Pérez')).toBeInTheDocument();

    // Clic en Aprobar de la primera fila abre ConfirmDialog
    const botonesAprobar = within(tablaPendientes).getAllByRole('button', {
      name: /^Aprobar$/i
    });
    fireEvent.click(botonesAprobar[0]);

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/Aprobar solicitud/i)).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole('button', { name: /^Aprobar$/i }));

    await waitFor(() => {
      expect(reservasService.aprobarReserva).toHaveBeenCalledWith(24);
    });
  });

  it('renders business analytics and classroom occupancy metrics correctly', async () => {
    render(
      <MemoryRouter>
        <Resumen />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('heading', { name: /Métricas de gestión y ocupación mensual/i })
    ).toBeInTheDocument();

    const seccionMetricas = screen.getByRole('region', {
      name: /Métricas de gestión y ocupación mensual/i
    });
    expect(within(seccionMetricas).getByText('Aula 101')).toBeInTheDocument();
    expect(within(seccionMetricas).getByRole('progressbar')).toHaveAttribute('value', '45');
    expect(within(seccionMetricas).getByText(/18.5 hs reservadas/i)).toBeInTheDocument();
    expect(screen.getByText(/\(70%\)/i)).toBeInTheDocument();
  });
});

