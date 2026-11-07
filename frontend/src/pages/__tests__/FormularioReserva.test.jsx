import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FormularioReserva from '../FormularioReserva.jsx';
import * as aulaService from '../../services/aula.service.js';
import * as reservasService from '../../services/reservas.service.js';

vi.mock('../../services/aula.service.js', () => ({
  getAulas: vi.fn()
}));

vi.mock('../../services/reservas.service.js', () => ({
  crearReserva: vi.fn(),
  getReserva: vi.fn(),
  editarReserva: vi.fn()
}));

const aulasMock = [
  { id: 1, nombre: 'Aula 910', ubicacion: 'Ed. Possetto - Piso 1', capacidad: 45, activa: true },
  { id: 2, nombre: 'Laboratorio A6', ubicacion: 'Ed. Possetto - PB', capacidad: 30, activa: true }
];

describe('FormularioReserva page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aulaService.getAulas.mockResolvedValue({ data: aulasMock });
  });

  it('loads active classrooms and submits a new reservation successfully', async () => {
    reservasService.crearReserva.mockResolvedValueOnce({ data: { id: 25 } });

    render(
      <MemoryRouter>
        <FormularioReserva />
      </MemoryRouter>
    );

    expect(await screen.findByRole('option', { name: /Aula 910/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Aula/i), {
      target: { name: 'aulaId', value: '1' }
    });
    fireEvent.change(screen.getByLabelText(/Fecha/i), {
      target: { name: 'fecha', value: '2026-11-20' }
    });
    fireEvent.change(screen.getByLabelText(/Hora de inicio/i), {
      target: { name: 'horaInicio', value: '10:00' }
    });
    fireEvent.change(screen.getByLabelText(/Hora de fin/i), {
      target: { name: 'horaFin', value: '12:00' }
    });
    fireEvent.change(screen.getByLabelText(/Cantidad de personas/i), {
      target: { name: 'cantidadPersonas', value: '20' }
    });
    fireEvent.change(screen.getByLabelText(/Motivo/i), {
      target: { name: 'motivo', value: 'Parcial de Desarrollo de Software' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Crear reserva/i }));

    await waitFor(() => {
      expect(reservasService.crearReserva).toHaveBeenCalledWith({
        aulaId: '1',
        fecha: '2026-11-20',
        horaInicio: '10:00',
        horaFin: '12:00',
        cantidadPersonas: '20',
        motivo: 'Parcial de Desarrollo de Software'
      });
    });
  });

  it('displays an overlap error message when creating a reservation in an occupied slot', async () => {
    reservasService.crearReserva.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { error: 'El aula ya está reservada en ese horario' }
      }
    });

    render(
      <MemoryRouter>
        <FormularioReserva />
      </MemoryRouter>
    );

    await screen.findByRole('option', { name: /Aula 910/i });

    fireEvent.change(screen.getByLabelText(/Aula/i), {
      target: { name: 'aulaId', value: '1' }
    });
    fireEvent.change(screen.getByLabelText(/Fecha/i), {
      target: { name: 'fecha', value: '2026-11-20' }
    });
    fireEvent.change(screen.getByLabelText(/Hora de inicio/i), {
      target: { name: 'horaInicio', value: '10:00' }
    });
    fireEvent.change(screen.getByLabelText(/Hora de fin/i), {
      target: { name: 'horaFin', value: '12:00' }
    });
    fireEvent.change(screen.getByLabelText(/Cantidad de personas/i), {
      target: { name: 'cantidadPersonas', value: '25' }
    });
    fireEvent.change(screen.getByLabelText(/Motivo/i), {
      target: { name: 'motivo', value: 'Intento solapado' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Crear reserva/i }));

    expect(
      await screen.findByText(/El horario solicitado no está disponible\. El aula ya tiene una reserva en ese período/i)
    ).toBeInTheDocument();
  });
});
