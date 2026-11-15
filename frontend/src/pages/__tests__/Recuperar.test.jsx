import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Recuperar from '../Recuperar.jsx';

/**
 * Antes no existía ninguna forma de recuperar una contraseña: el pie del
 * ingreso solo ofrecía crear cuenta, y quien se olvidaba la suya no tenía más
 * salida que abrirse otra con otro correo.
 */

const mockCreate = vi.fn();
const mockAttemptFirstFactor = vi.fn();
const mockSetActive = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@clerk/clerk-react', () => ({
  useSignIn: () => ({
    isLoaded: true,
    setActive: mockSetActive,
    signIn: { create: mockCreate, attemptFirstFactor: mockAttemptFirstFactor }
  })
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate
}));

const montar = () =>
  render(
    <MemoryRouter>
      <Recuperar />
    </MemoryRouter>
  );

const pedirCodigoPara = async (email) => {
  fireEvent.input(screen.getByLabelText(/Correo electrónico/i), {
    target: { name: 'email', value: email }
  });
  fireEvent.click(screen.getByRole('button', { name: /Enviar código/i }));
  return screen.findByLabelText(/Código de verificación/i);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({});
});

describe('Recuperar contraseña', () => {
  it('dice de entrada qué cuentas alcanza, antes de que alguien espere un correo', () => {
    montar();

    expect(screen.getByText(/creadas desde esta aplicación/i)).toBeInTheDocument();
    expect(screen.getByText(/bedelía/i)).toBeInTheDocument();
  });

  it('pide el código a Clerk con la estrategia de restablecer', async () => {
    montar();
    await pedirCodigoPara('santi@example.com');

    expect(mockCreate).toHaveBeenCalledWith({
      strategy: 'reset_password_email_code',
      identifier: 'santi@example.com'
    });
  });

  /**
   * Si la respuesta cambiara según el correo exista o no, esta pantalla sería
   * una forma cómoda de averiguar quién tiene cuenta en el sistema.
   */
  it('no revela si el correo tiene cuenta: responde igual en los dos casos', async () => {
    const { unmount } = montar();
    await pedirCodigoPara('existe@example.com');
    const conCuenta = screen.getByText(/le enviamos un código/i).textContent;
    // Se desmonta antes del segundo caso: si no, lo que quedó en pantalla del
    // primero haría pasar la prueba aunque el segundo no llegara a ningún lado.
    unmount();

    vi.clearAllMocks();
    mockCreate.mockRejectedValue(
      Object.assign(new Error('not found'), {
        errors: [{ code: 'form_identifier_not_found' }]
      })
    );

    montar();
    await pedirCodigoPara('no-existe@example.com');
    const sinCuenta = screen.getByText(/le enviamos un código/i).textContent;

    expect(sinCuenta).toBe(conCuenta);
  });

  it('avanza al paso del código aunque el correo no exista', async () => {
    mockCreate.mockRejectedValue(new Error('not found'));

    montar();
    expect(await pedirCodigoPara('no-existe@example.com')).toBeInTheDocument();
  });

  it('guarda la contraseña nueva y abre la sesión', async () => {
    mockAttemptFirstFactor.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_9'
    });

    montar();
    await pedirCodigoPara('santi@example.com');

    fireEvent.input(screen.getByLabelText(/Código de verificación/i), {
      target: { name: 'codigo', value: '123456' }
    });
    fireEvent.input(screen.getByLabelText(/^Contraseña nueva/i), {
      target: { name: 'contrasena', value: 'nuevaclave1' }
    });
    fireEvent.input(screen.getByLabelText(/Repetir la contraseña/i), {
      target: { name: 'repetida', value: 'nuevaclave1' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar la contraseña/i }));

    await waitFor(() => {
      expect(mockAttemptFirstFactor).toHaveBeenCalledWith({
        strategy: 'reset_password_email_code',
        code: '123456',
        password: 'nuevaclave1'
      });
    });
    expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_9' });
    expect(mockNavigate).toHaveBeenCalledWith('/reservas');
  });

  it('no manda nada si las dos contraseñas no coinciden', async () => {
    montar();
    await pedirCodigoPara('santi@example.com');

    fireEvent.input(screen.getByLabelText(/Código de verificación/i), {
      target: { name: 'codigo', value: '123456' }
    });
    fireEvent.input(screen.getByLabelText(/^Contraseña nueva/i), {
      target: { name: 'contrasena', value: 'nuevaclave1' }
    });
    fireEvent.input(screen.getByLabelText(/Repetir la contraseña/i), {
      target: { name: 'repetida', value: 'otracosa' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar la contraseña/i }));

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
    expect(mockAttemptFirstFactor).not.toHaveBeenCalled();
  });

  it('el paso del código también tiene salidas', async () => {
    montar();
    await pedirCodigoPara('santi@example.com');

    expect(screen.getByRole('button', { name: /otro correo/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ingreso/i })).toHaveAttribute('href', '/login');
  });

  it('avisa cuando el código no sirve, en vez de quedarse callado', async () => {
    mockAttemptFirstFactor.mockRejectedValue(
      Object.assign(new Error('bad code'), {
        errors: [{ longMessage: 'El código es incorrecto.' }]
      })
    );

    montar();
    await pedirCodigoPara('santi@example.com');

    fireEvent.input(screen.getByLabelText(/Código de verificación/i), {
      target: { name: 'codigo', value: '000000' }
    });
    fireEvent.input(screen.getByLabelText(/^Contraseña nueva/i), {
      target: { name: 'contrasena', value: 'nuevaclave1' }
    });
    fireEvent.input(screen.getByLabelText(/Repetir la contraseña/i), {
      target: { name: 'repetida', value: 'nuevaclave1' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar la contraseña/i }));

    expect(await screen.findByText('El código es incorrecto.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
