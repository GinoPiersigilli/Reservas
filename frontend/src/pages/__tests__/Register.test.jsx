import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from '../Register.jsx';

const mockAuthenticateWithRedirect = vi.fn();
const mockCreate = vi.fn();
const mockPrepararVerificacion = vi.fn();
const mockIntentarVerificacion = vi.fn();
const mockSetActive = vi.fn();
const mockNavigate = vi.fn();
let mockIsLoaded = true;

vi.mock('@clerk/clerk-react', () => ({
  useSignUp: () => ({
    isLoaded: mockIsLoaded,
    setActive: mockSetActive,
    signUp: {
      authenticateWithRedirect: mockAuthenticateWithRedirect,
      create: mockCreate,
      prepareEmailAddressVerification: mockPrepararVerificacion,
      attemptEmailAddressVerification: mockIntentarVerificacion
    }
  }),
  AuthenticateWithRedirectCallback: () => null
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate
}));

/** Completa los cuatro campos del formulario de alta. */
const completarFormulario = ({ email = 'test@example.com' } = {}) => {
  fireEvent.input(screen.getByLabelText(/Nombre completo/i), {
    target: { name: 'nombre', value: 'Usuario De Prueba' }
  });
  fireEvent.input(screen.getByLabelText(/Correo electrónico/i), {
    target: { name: 'email', value: email }
  });
  fireEvent.input(screen.getByLabelText(/^Contraseña/i), {
    target: { name: 'password', value: '123456' }
  });
  fireEvent.input(screen.getByLabelText(/Confirmar contraseña/i), {
    target: { name: 'confirmPassword', value: '123456' }
  });
};

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockAuthenticateWithRedirect.mockResolvedValue({});
    mockPrepararVerificacion.mockResolvedValue({});
    mockSetActive.mockResolvedValue({});
  });

  it('renders the registration form without English or Clerk text', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmar contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Crear cuenta$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrarse con Google/i })).toBeInTheDocument();
    expect(screen.queryByText(/Sign Up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Clerk/i)).not.toBeInTheDocument();
  });

  it('renders "Registrarse con Google" button and triggers OAuth redirect flow', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const botonGoogle = screen.getByRole('button', { name: /Registrarse con Google/i });
    fireEvent.click(botonGoogle);

    expect(mockAuthenticateWithRedirect).toHaveBeenCalledTimes(1);
    expect(mockAuthenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/reservas'
    });
  });

  it('disables "Registrarse con Google" button when Clerk is not loaded', () => {
    mockIsLoaded = false;

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const botonGoogle = screen.getByRole('button', { name: /Registrarse con Google/i });
    expect(botonGoogle).toBeDisabled();
  });

  it('displays Spanish error message when Google OAuth redirect fails', async () => {
    mockAuthenticateWithRedirect.mockRejectedValueOnce(new Error('Registro cancelado'));

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const botonGoogle = screen.getByRole('button', { name: /Registrarse con Google/i });
    fireEvent.click(botonGoogle);

    expect(await screen.findByText(/Registro cancelado/i)).toBeInTheDocument();
    expect(botonGoogle).not.toBeDisabled();
  });

  it('re-enables "Registrarse con Google" button when restored from bfcache (pageshow persisted=true)', () => {
    mockAuthenticateWithRedirect.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const botonGoogle = screen.getByRole('button', { name: /Registrarse con Google/i });
    fireEvent.click(botonGoogle);

    expect(botonGoogle).toBeDisabled();
    expect(botonGoogle).toHaveAttribute('aria-busy', 'true');

    act(() => {
      const event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', { value: true });
      window.dispatchEvent(event);
    });

    expect(botonGoogle).not.toBeDisabled();
    expect(botonGoogle).toHaveAttribute('aria-busy', 'false');
  });

  it('re-enables "Registrarse con Google" button and displays Spanish error after 20s safety timeout', () => {
    vi.useFakeTimers();
    mockAuthenticateWithRedirect.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const botonGoogle = screen.getByRole('button', { name: /Registrarse con Google/i });
    fireEvent.click(botonGoogle);

    expect(botonGoogle).toBeDisabled();
    expect(botonGoogle).toHaveAttribute('aria-busy', 'true');

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(
      screen.getByText('No se completó el ingreso con Google. Intente de nuevo.')
    ).toBeInTheDocument();
    expect(botonGoogle).not.toBeDisabled();
    expect(botonGoogle).toHaveAttribute('aria-busy', 'false');

    vi.useRealTimers();
  });

  // El alta la resuelve Clerk: no hay ruta de registro local (ver ADR 0002).
  // Antes el formulario pegaba a POST /api/auth/register, que nunca existió, y
  // devolvía 404 en cada intento.

  it('crea la cuenta en Clerk con el nombre partido en nombre y apellido', async () => {
    mockCreate.mockResolvedValueOnce({ status: 'missing_requirements' });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        emailAddress: 'test@example.com',
        password: '123456',
        firstName: 'Usuario',
        lastName: 'De Prueba'
      });
    });
  });

  it('abre la sesión sin pedir código cuando Clerk no exige verificar el correo', async () => {
    mockCreate.mockResolvedValueOnce({ status: 'complete', createdSessionId: 'sess_1' });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/i }));

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_1' });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/reservas');
    expect(mockPrepararVerificacion).not.toHaveBeenCalled();
  });

  it('pide el código cuando Clerk exige verificar el correo, y abre la sesión al confirmarlo', async () => {
    mockCreate.mockResolvedValueOnce({ status: 'missing_requirements' });
    mockIntentarVerificacion.mockResolvedValueOnce({
      status: 'complete',
      createdSessionId: 'sess_2'
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/i }));

    expect(await screen.findByLabelText(/Código de verificación/i)).toBeInTheDocument();
    expect(mockPrepararVerificacion).toHaveBeenCalledWith({ strategy: 'email_code' });

    fireEvent.input(screen.getByLabelText(/Código de verificación/i), {
      target: { name: 'codigo', value: '123456' }
    });
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(mockIntentarVerificacion).toHaveBeenCalledWith({ code: '123456' });
    });
    expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_2' });
    expect(mockNavigate).toHaveBeenCalledWith('/reservas');
  });

  it('muestra el mensaje de Clerk cuando el correo ya está registrado', async () => {
    mockCreate.mockRejectedValueOnce({
      errors: [{ longMessage: 'Ese correo ya tiene una cuenta.' }]
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    completarFormulario({ email: 'existing@example.com' });
    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/i }));

    expect(await screen.findByText(/Ese correo ya tiene una cuenta/i)).toBeInTheDocument();
  });

  it('avisa cuando el código es incorrecto y deja pedir uno nuevo', async () => {
    mockCreate.mockResolvedValueOnce({ status: 'missing_requirements' });
    mockIntentarVerificacion.mockResolvedValueOnce({ status: 'missing_requirements' });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/i }));

    fireEvent.input(await screen.findByLabelText(/Código de verificación/i), {
      target: { name: 'codigo', value: '000000' }
    });
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    expect(await screen.findByText(/El código no es correcto o venció/i)).toBeInTheDocument();
    expect(mockSetActive).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Reenviar código/i }));
    expect(await screen.findByText(/Le enviamos un código nuevo/i)).toBeInTheDocument();
  });
});
