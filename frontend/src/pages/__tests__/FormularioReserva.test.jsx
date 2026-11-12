import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FormularioReserva from '../FormularioReserva.jsx';
import * as aulaService from '../../services/aula.service.js';
import * as reservasService from '../../services/reservas.service.js';

vi.mock('../../services/aula.service.js', () => ({
  getAulas: vi.fn(),
  getDisponibilidadAula: vi.fn()
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

describe('FormularioReserva page y GrillaDisponibilidad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aulaService.getAulas.mockResolvedValue({ data: aulasMock });
    aulaService.getDisponibilidadAula.mockResolvedValue({ data: [] });
  });

  it('loads active classrooms and submits a new reservation successfully', async () => {
    reservasService.crearReserva.mockResolvedValueOnce({ data: { id: 25 } });

    render(
      <MemoryRouter>
        <FormularioReserva />
      </MemoryRouter>
    );

    expect(await screen.findByRole('option', { name: /Aula 910/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Aula/i, { selector: 'select' }), {
      target: { name: 'aulaId', value: '1' }
    });
    fireEvent.change(screen.getByLabelText(/^Fecha/i), {
      target: { name: 'fecha', value: '2027-11-20' }
    });
    fireEvent.change(screen.getByLabelText(/^Hora de inicio/i), {
      target: { name: 'horaInicio', value: '10:00' }
    });
    fireEvent.change(screen.getByLabelText(/^Hora de fin/i), {
      target: { name: 'horaFin', value: '12:00' }
    });
    fireEvent.change(screen.getByLabelText(/^Cantidad de personas/i), {
      target: { name: 'cantidadPersonas', value: '20' }
    });
    fireEvent.change(screen.getByLabelText(/^Motivo/i), {
      target: { name: 'motivo', value: 'Parcial de Desarrollo de Software' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Reservar aula/i }));

    await waitFor(() => {
      expect(reservasService.crearReserva).toHaveBeenCalledWith(
        {
          aulaId: '1',
          fecha: '2027-11-20',
          horaInicio: '10:00',
          horaFin: '12:00',
          cantidadPersonas: '20',
          motivo: 'Parcial de Desarrollo de Software'
        },
        expect.objectContaining({
          idempotencyKey: expect.any(String)
        })
      );
    });
  });

  it('displays server overlap error message in the form when creating a reservation in an occupied slot', async () => {
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

    fireEvent.change(screen.getByLabelText(/^Aula/i, { selector: 'select' }), {
      target: { name: 'aulaId', value: '1' }
    });
    fireEvent.change(screen.getByLabelText(/^Fecha/i), {
      target: { name: 'fecha', value: '2027-11-20' }
    });
    fireEvent.change(screen.getByLabelText(/^Hora de inicio/i), {
      target: { name: 'horaInicio', value: '10:00' }
    });
    fireEvent.change(screen.getByLabelText(/^Hora de fin/i), {
      target: { name: 'horaFin', value: '12:00' }
    });
    fireEvent.change(screen.getByLabelText(/^Cantidad de personas/i), {
      target: { name: 'cantidadPersonas', value: '25' }
    });
    fireEvent.change(screen.getByLabelText(/^Motivo/i), {
      target: { name: 'motivo', value: 'Intento solapado' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Reservar aula/i }));

    expect(
      await screen.findByText(/El aula ya está reservada en ese horario/i)
    ).toBeInTheDocument();
  });

  it('disables occupied slots in the availability grid and synchronizes two-click selection on free slots', async () => {
    aulaService.getDisponibilidadAula.mockImplementation((aulaId) => {
      if (Number(aulaId) === 1) {
        return Promise.resolve({
          data: [{ horaInicio: '10:00', horaFin: '11:00', estado: 'aprobada' }]
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter>
        <FormularioReserva />
      </MemoryRouter>
    );

    await screen.findByRole('option', { name: /Aula 910/i });

    fireEvent.change(screen.getByLabelText(/^Fecha/i), {
      target: { name: 'fecha', value: '2027-11-20' }
    });

    const celdaOcupada = await screen.findByRole('button', {
      name: /Aula 910, 10:00 a 11:00, ocupada/i
    });
    expect(celdaOcupada).toBeDisabled();

    // Selección con dos clics en franja libre (14:00 a 15:00 en Aula 910)
    const celdaInicioLibre = screen.getByRole('button', {
      name: /Aula 910, 14:00 a 14:30, libre/i
    });
    const celdaFinLibre = screen.getByRole('button', {
      name: /Aula 910, 14:30 a 15:00, libre/i
    });

    fireEvent.click(celdaInicioLibre);
    fireEvent.click(celdaFinLibre);

    expect(screen.getByLabelText(/^Hora de inicio/i)).toHaveValue('14:00');
    expect(screen.getByLabelText(/^Hora de fin/i)).toHaveValue('15:00');
    expect(screen.getByText(/Seleccionado: Aula 910/i)).toHaveTextContent(
      '14:00 a 15:00'
    );
  });

  it('prefills start and end times in compact view when tapping a grouped free slot', async () => {
    aulaService.getDisponibilidadAula.mockImplementation((aulaId) => {
      if (Number(aulaId) === 1) {
        return Promise.resolve({
          data: [{ horaInicio: '11:00', horaFin: '13:00', estado: 'aprobada' }]
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter>
        <FormularioReserva />
      </MemoryRouter>
    );

    await screen.findByRole('option', { name: /Aula 910/i });

    fireEvent.change(screen.getByLabelText(/^Fecha/i), {
      target: { name: 'fecha', value: '2027-11-20' }
    });

    expect(
      await screen.findByText(/Ocupada 11:00–13:00, aprobada/i)
    ).toBeInTheDocument();

    const tramoLibre0811 = screen.getByRole('button', {
      name: /Aula 910, libre de 08:00 a 11:00/i
    });
    fireEvent.click(tramoLibre0811);

    expect(screen.getByLabelText(/^Hora de inicio/i)).toHaveValue('08:00');
    expect(screen.getByLabelText(/^Hora de fin/i)).toHaveValue('11:00');
    expect(screen.getByText(/Seleccionado: Aula 910/i)).toHaveTextContent(
      '08:00 a 11:00'
    );
  });
});
