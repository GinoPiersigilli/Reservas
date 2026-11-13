import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Aulas from '../Aulas.jsx';
import * as aulaService from '../../services/aula.service.js';

vi.mock('../../services/aula.service.js', () => ({
  getAulas: vi.fn(),
  crearAula: vi.fn(),
  editarAula: vi.fn(),
  desactivarAula: vi.fn(),
  reactivarAula: vi.fn()
}));

const mockAulas = [
  {
    id: 1,
    nombre: 'Aula 910',
    ubicacion: 'Ed. Possetto - Piso 1',
    capacidad: 45,
    recursos: 'proyector, pizarra',
    activa: true
  },
  {
    id: 2,
    nombre: 'Laboratorio A6',
    ubicacion: 'Ed. Possetto - PB',
    capacidad: 30,
    recursos: '30 PCs, proyector',
    activa: true
  },
  {
    id: 3,
    nombre: 'Aula 104 Inactiva',
    ubicacion: 'Ed. Central - Piso 2',
    capacidad: 25,
    recursos: null,
    activa: false
  }
];

describe('Aulas (Gestión y ABM de Aulas para Administradores)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aulaService.getAulas.mockResolvedValue({ data: mockAulas });
  });

  it('renderiza la lista de aulas con nombre, ubicación, capacidad, estado y acciones', async () => {
    render(
      <MemoryRouter>
        <Aulas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aula 910')).toBeInTheDocument();
      expect(screen.getByText('Laboratorio A6')).toBeInTheDocument();
      expect(screen.getByText('Aula 104 Inactiva')).toBeInTheDocument();
    });

    // Filtros de estado
    expect(screen.getByRole('button', { name: /Todas \(3\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activas \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inactivas \(1\)/i })).toBeInTheDocument();
  });

  it('permite filtrar aulas activas e inactivas mediante los botones de estado', async () => {
    render(
      <MemoryRouter>
        <Aulas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aula 910')).toBeInTheDocument();
    });

    // Clic en "Inactivas"
    fireEvent.click(screen.getByRole('button', { name: /^Inactivas/i }));

    expect(screen.getByText('Aula 104 Inactiva')).toBeInTheDocument();
    expect(screen.queryByText('Aula 910')).not.toBeInTheDocument();
    expect(screen.queryByText('Laboratorio A6')).not.toBeInTheDocument();

    // Clic en "Activas"
    fireEvent.click(screen.getByRole('button', { name: /^Activas/i }));

    expect(screen.getByText('Aula 910')).toBeInTheDocument();
    expect(screen.getByText('Laboratorio A6')).toBeInTheDocument();
    expect(screen.queryByText('Aula 104 Inactiva')).not.toBeInTheDocument();
  });

  it('permite abrir el modal de nueva aula, validar campos y crear un aula exitosamente', async () => {
    aulaService.crearAula.mockResolvedValueOnce({
      data: {
        id: 4,
        nombre: 'Aula Nueva',
        ubicacion: 'Pabellón Nuevo',
        capacidad: 50,
        recursos: 'Pizarra',
        activa: true
      }
    });

    render(
      <MemoryRouter>
        <Aulas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aula 910')).toBeInTheDocument();
    });

    // Abrir modal
    fireEvent.click(screen.getByRole('button', { name: /Nueva aula/i }));

    expect(screen.getByRole('heading', { name: /Nueva aula/i })).toBeInTheDocument();

    // Intentar guardar vacío para probar validación
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));
    expect(screen.getByText(/El nombre del aula es obligatorio/i)).toBeInTheDocument();

    // Completar formulario
    fireEvent.change(screen.getByPlaceholderText(/Ej\. Aula 101 Magna/i), {
      target: { value: 'Aula Nueva' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Ej\. Pabellón Central/i), {
      target: { value: 'Pabellón Nuevo' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Ej\. 45/i), {
      target: { value: '50' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Ej\. proyector, pizarra/i), {
      target: { value: 'Pizarra' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    await waitFor(() => {
      expect(aulaService.crearAula).toHaveBeenCalledWith({
        nombre: 'Aula Nueva',
        ubicacion: 'Pabellón Nuevo',
        capacidad: 50,
        recursos: 'Pizarra'
      });
      expect(screen.getByText(/Aula creada\./i)).toBeInTheDocument();
    });
  });

  it('permite abrir el modal de edición y guardar cambios', async () => {
    aulaService.editarAula.mockResolvedValueOnce({
      data: {
        id: 1,
        nombre: 'Aula 910 Editada',
        ubicacion: 'Ed. Possetto - Piso 1',
        capacidad: 60,
        recursos: 'proyector, pizarra',
        activa: true
      }
    });

    render(
      <MemoryRouter>
        <Aulas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aula 910')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/Editar Aula 910/i));

    expect(screen.getByRole('heading', { name: /Editar aula/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Ej\. 45/i), {
      target: { value: '60' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    await waitFor(() => {
      expect(aulaService.editarAula).toHaveBeenCalledWith(1, {
        nombre: 'Aula 910',
        ubicacion: 'Ed. Possetto - Piso 1',
        capacidad: 60,
        recursos: 'proyector, pizarra'
      });
      expect(screen.getByText(/Cambios guardados\./i)).toBeInTheDocument();
    });
  });

  it('gestiona el flujo de desactivación con aviso de reservas futuras y motivo requerido', async () => {
    // Primer intento: el backend responde 409 con reservasAfectadas
    aulaService.desactivarAula.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          error: 'El aula tiene reservas futuras activas',
          reservasAfectadas: 2
        }
      }
    });

    // Segundo intento con motivo: responde 200
    aulaService.desactivarAula.mockResolvedValueOnce({
      data: {
        aula: { id: 1, activa: false },
        reservasCanceladas: 2
      }
    });

    render(
      <MemoryRouter>
        <Aulas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aula 910')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/Desactivar Aula 910/i));

    expect(screen.getByRole('heading', { name: /Desactivar aula/i })).toBeInTheDocument();

    // Confirmar sin cancelar reservas
    fireEvent.click(screen.getByRole('button', { name: /^Desactivar$/i }));

    // Aparece el aviso de reservas futuras afectadas
    await waitFor(() => {
      expect(
        screen.getByText(/El aula tiene 2 reserva\(s\) futura\(s\) activa\(s\)\./i)
      ).toBeInTheDocument();
    });

    // Si intenta confirmar con checkbox activo pero sin motivo, valida
    fireEvent.click(screen.getByRole('button', { name: /^Desactivar$/i }));
    expect(screen.getByText(/Ingrese un motivo para la baja del aula\./i)).toBeInTheDocument();

    // Ingresar motivo
    fireEvent.change(screen.getByPlaceholderText(/Ingrese el motivo de la baja del aula\.\.\./i), {
      target: { value: 'Obras de mantenimiento' }
    });

    fireEvent.click(screen.getByRole('button', { name: /^Desactivar$/i }));

    await waitFor(() => {
      expect(aulaService.desactivarAula).toHaveBeenCalledWith(1, {
        cancelarReservasFuturas: true,
        motivo: 'Obras de mantenimiento'
      });
      expect(screen.getByText(/Aula desactivada\./i)).toBeInTheDocument();
    });
  });

  it('permite reactivar un aula inactiva con confirmación', async () => {
    aulaService.reactivarAula.mockResolvedValueOnce({
      data: { id: 3, activa: true }
    });

    render(
      <MemoryRouter>
        <Aulas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aula 104 Inactiva')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/Reactivar Aula 104 Inactiva/i));

    expect(screen.getByRole('heading', { name: /Reactivar aula/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Reactivar$/i }));

    await waitFor(() => {
      expect(aulaService.reactivarAula).toHaveBeenCalledWith(3);
      expect(screen.getByText(/Aula reactivada\./i)).toBeInTheDocument();
    });
  });

  it('muestra estado de error con botón de reintentar si falla la carga', async () => {
    aulaService.getAulas.mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter>
        <Aulas />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No se pudieron cargar las aulas\. Intente de nuevo\./i)
      ).toBeInTheDocument();
    });

    aulaService.getAulas.mockResolvedValueOnce({ data: mockAulas });
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

    await waitFor(() => {
      expect(screen.getByText('Aula 910')).toBeInTheDocument();
    });
  });
});
