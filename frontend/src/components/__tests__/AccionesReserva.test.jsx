import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccionesReserva from '../AccionesReserva.jsx';

/**
 * Cuando una acción fallaba, el diálogo quedaba abierto y el mensaje se dibujaba
 * en la barra de acciones, que está debajo del telón del modal. La persona
 * confirmaba, algo fallaba, y para ella no pasaba nada: el error existía pero
 * era invisible.
 */

const mockAprobar = vi.fn();

vi.mock('../../services/reservas.service.js', () => ({
  aprobarReserva: (...args) => mockAprobar(...args),
  rechazarReserva: vi.fn(),
  cancelarReserva: vi.fn()
}));

const ADMIN = { id: 1, rol: 'admin' };
const RESERVA = { id: 7, estado: 'pendiente', usuarioId: 99 };

const montar = (props = {}) =>
  render(
    <MemoryRouter>
      <AccionesReserva reserva={RESERVA} usuario={ADMIN} {...props} />
    </MemoryRouter>
  );

/** Abre el diálogo de aprobación y confirma. */
const aprobarYConfirmar = async () => {
  fireEvent.click(screen.getByRole('button', { name: /^Aprobar$/i }));
  const dialogo = await screen.findByRole('dialog');
  fireEvent.click(within(dialogo).getByRole('button', { name: /^Aprobar$/i }));
  return dialogo;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccionesReserva cuando la acción falla', () => {
  it('muestra el error dentro del diálogo, donde se puede ver', async () => {
    mockAprobar.mockRejectedValue({
      response: { data: { error: 'El aula fue dada de baja.' } }
    });

    montar();
    const dialogo = await aprobarYConfirmar();

    const alerta = await within(dialogo).findByRole('alert');
    expect(alerta).toHaveTextContent('El aula fue dada de baja.');
  });

  it('deja el diálogo abierto para poder reintentar o cancelar', async () => {
    mockAprobar.mockRejectedValue(new Error('se cayó la red'));

    montar();
    await aprobarYConfirmar();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Cancelar$/i })).toBeEnabled();
  });

  it('descarta el error al cerrar: ya no hay acción a la que atribuirlo', async () => {
    mockAprobar.mockRejectedValue(new Error('se cayó la red'));

    montar();
    const dialogo = await aprobarYConfirmar();
    await within(dialogo).findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Aprobar$/i }));

    const reabierto = await screen.findByRole('dialog');
    expect(within(reabierto).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cierra el diálogo y avisa cuando la acción sale bien', async () => {
    mockAprobar.mockResolvedValue({});
    const onAccion = vi.fn();

    montar({ onAccion });
    await aprobarYConfirmar();

    await waitFor(() => {
      expect(onAccion).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
