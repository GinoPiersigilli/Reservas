import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reservas from '../Reservas.jsx';
import * as AuthContextModule from '../../context/AuthContext.jsx';
import * as reservasService from '../../services/reservas.service.js';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: vi.fn()
}));

vi.mock('../../services/reservas.service.js', () => ({
  getReservas: vi.fn()
}));

describe('Reservas page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AuthContextModule.useAuth.mockReturnValue({
      usuario: { id: 2, nombre: 'David López', email: 'david@utnfrc.edu.ar', rol: 'usuario' },
      cerrarSesion: vi.fn()
    });
  });

  it('renders the list of reservations returned by the API for a regular user', async () => {
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

    expect(screen.getByRole('heading', { name: 'Mis reservas' })).toBeInTheDocument();
    expect(await screen.findByText('Clase de consulta - Análisis Matemático')).toBeInTheDocument();
    const tabla = screen.getByRole('table', { name: /Listado de reservas/i });
    expect(within(tabla).getByText('Simulacro de parcial')).toBeInTheDocument();
    expect(within(tabla).getByText('#10')).toBeInTheDocument();
    expect(within(tabla).getByText('#11')).toBeInTheDocument();
    expect(within(tabla).getByText('10/11/2026')).toBeInTheDocument();
    expect(within(tabla).getByText('Aprobada')).toBeInTheDocument();
    expect(within(tabla).getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Solicitante' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(reservasService.getReservas).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10 })
      );
    });
  });

  it('shows title "Reservas" and column "Solicitante" for admin users', async () => {
    AuthContextModule.useAuth.mockReturnValue({
      usuario: { id: 1, nombre: 'Admin UTN', email: 'admin@utnfrc.edu.ar', rol: 'admin' },
      cerrarSesion: vi.fn()
    });

    reservasService.getReservas.mockResolvedValueOnce({
      data: {
        total: 2,
        pagina: 1,
        porPagina: 10,
        datos: [
          {
            id: 25,
            aulaId: 1,
            usuarioId: 2,
            usuario: { id: 2, nombre: 'David López', email: 'david@utnfrc.edu.ar' },
            fecha: '2026-11-12',
            horaInicio: '10:00',
            horaFin: '12:00',
            cantidadPersonas: 30,
            motivo: 'Parcial Física',
            estado: 'pendiente'
          },
          {
            id: 26,
            aulaId: 1,
            usuarioId: 3,
            fecha: '2026-11-12',
            horaInicio: '14:00',
            horaFin: '16:00',
            cantidadPersonas: 20,
            motivo: 'Consulta Álgebra',
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

    expect(screen.getByRole('heading', { name: 'Reservas' })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Solicitante' })).toBeInTheDocument();
    const nombreSolicitante = screen.getByText('David López');
    expect(nombreSolicitante).toBeInTheDocument();
    expect(nombreSolicitante).toHaveAttribute('title', 'david@utnfrc.edu.ar');
    expect(screen.getByText('Usuario #3')).toBeInTheDocument();
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

  it('shows error state with Reintentar button when loading reservations fails', async () => {
    reservasService.getReservas.mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter>
        <Reservas />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Error al cargar las reservas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
