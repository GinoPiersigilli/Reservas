import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reservas from '../Reservas.jsx';
import * as reservasService from '../../services/reservas.service.js';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    usuario: { id: 2, nombre: 'David López', email: 'david@utnfrc.edu.ar', rol: 'usuario' },
    cerrarSesion: vi.fn()
  })
}));

vi.mock('../../services/reservas.service.js', () => ({
  getReservas: vi.fn()
}));

describe('Reservas page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the list of reservations returned by the API', async () => {
    reservasService.getReservas.mockResolvedValueOnce({
      data: {
        total: 2,
        pagina: 1,
        porPagina: 10,
        datos: [
          {
            id: 10,
            aulaId: 1,
            fecha: '2026-11-10',
            horaInicio: '09:00',
            horaFin: '11:00',
            cantidadPersonas: 30,
            motivo: 'Clase de consulta - Análisis Matemático',
            estado: 'aprobada'
          },
          {
            id: 11,
            aulaId: 3,
            fecha: '2026-11-12',
            horaInicio: '14:00',
            horaFin: '16:00',
            cantidadPersonas: 40,
            motivo: 'Simulacro de parcial',
            estado: 'pendiente'
          }
        ]
      }
    });

    render(
      <MemoryRouter>
        <Reservas />
      </MemoryRouter>
    );

    expect(await screen.findByText('Clase de consulta - Análisis Matemático')).toBeInTheDocument();
    expect(screen.getByText('Simulacro de parcial')).toBeInTheDocument();
    expect(screen.getByText('#10')).toBeInTheDocument();
    expect(screen.getByText('#11')).toBeInTheDocument();
    expect(screen.getByText('Aprobada')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();

    await waitFor(() => {
      expect(reservasService.getReservas).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10 })
      );
    });
  });

  it('shows empty state when there are no reservations', async () => {
    reservasService.getReservas.mockResolvedValueOnce({
      data: { total: 0, pagina: 1, porPagina: 10, datos: [] }
    });

    render(
      <MemoryRouter>
        <Reservas />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No hay reservas/i)).toBeInTheDocument();
  });

  it('shows error alert when loading reservations fails', async () => {
    reservasService.getReservas.mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter>
        <Reservas />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Error al cargar las reservas/i)).toBeInTheDocument();
  });
});
