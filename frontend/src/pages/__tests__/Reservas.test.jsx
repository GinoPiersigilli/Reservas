import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    // La vista elegida se guarda en el navegador: sin limpiarla, un test
    // arrastraría la elección del anterior.
    window.localStorage.clear();
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

    // La agenda es la vista por defecto: una jornada por día, con el tramo
    // horario de cada reserva y su estado.
    const agenda = screen.getByRole('region', { name: /Agenda de reservas/i });
    expect(
      within(agenda).getByRole('heading', { name: /martes 10 de noviembre/i })
    ).toBeInTheDocument();
    expect(
      within(agenda).getByRole('heading', { name: /jueves 12 de noviembre/i })
    ).toBeInTheDocument();
    expect(within(agenda).getByText('Simulacro de parcial')).toBeInTheDocument();
    expect(within(agenda).getByText('09:00')).toBeInTheDocument();
    expect(within(agenda).getByText('11:00')).toBeInTheDocument();
    expect(
      within(agenda).getByRole('link', { name: /Reserva #10, Aula 1, de 09:00 a 11:00, aprobada/i })
    ).toHaveAttribute('href', '/reservas/10');
    expect(screen.queryByRole('table', { name: /Listado de reservas/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(reservasService.getReservas).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10, sortBy: 'fecha', order: 'ASC' })
      );
    });
  });

  it('shows title "Reservas" and column "Solicitante" for admin users', async () => {
    AuthContextModule.useAuth.mockReturnValue({
      usuario: { id: 1, nombre: 'Admin UTN', email: 'admin@utnfrc.edu.ar', rol: 'admin' },
      cerrarSesion: vi.fn()
    });

    reservasService.getReservas.mockResolvedValue({
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

    // En la agenda el solicitante aparece solo para administración.
    const agenda = await screen.findByRole('region', { name: /Agenda de reservas/i });
    expect(within(agenda).getByText('David López')).toHaveAttribute('title', 'david@utnfrc.edu.ar');
    expect(within(agenda).getByText('Usuario #3')).toBeInTheDocument();

    // Y la tabla ordenable sigue disponible con su columna Solicitante.
    fireEvent.click(screen.getByRole('button', { name: 'Tabla' }));

    expect(await screen.findByRole('columnheader', { name: 'Solicitante' })).toBeInTheDocument();
    const tabla = screen.getByRole('table', { name: /Listado de reservas/i });
    expect(within(tabla).getAllByText('12/11/2026')).toHaveLength(2);
    expect(screen.queryByRole('region', { name: /Agenda de reservas/i })).not.toBeInTheDocument();
  });

  it('remembers the chosen view between visits', async () => {
    window.localStorage.setItem('vistaReservas', 'tabla');

    reservasService.getReservas.mockResolvedValueOnce({
      data: {
        total: 1,
        pagina: 1,
        porPagina: 10,
        datos: [
          {
            id: 40,
            aulaId: 1,
            fecha: '2026-11-12',
            horaInicio: '10:00',
            horaFin: '12:00',
            cantidadPersonas: 10,
            motivo: 'Consulta Álgebra',
            estado: 'aprobada'
          }
        ]
      }
    });

    render(
      <MemoryRouter>
        <Reservas />
      </MemoryRouter>
    );

    expect(await screen.findByRole('table', { name: /Listado de reservas/i })).toBeInTheDocument();
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
