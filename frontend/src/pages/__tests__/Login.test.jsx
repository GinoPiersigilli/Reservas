import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext.jsx';
import Login from '../Login.jsx';

const mockAuthenticateWithRedirect = vi.fn();
let mockIsLoaded = true;

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
  useAuth: () => ({ getToken: vi.fn(), signOut: vi.fn() }),
  useSignIn: () => ({
    isLoaded: mockIsLoaded,
    signIn: { authenticateWithRedirect: mockAuthenticateWithRedirect }
  }),
  AuthenticateWithRedirectCallback: () => null
}));

describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockAuthenticateWithRedirect.mockResolvedValue({});
  });

  it('renders login form fields without emoji or inline test credentials', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole('heading', { name: 'Reservas de aulas' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ingresar$/i })).toBeInTheDocument();
  });

  it('renders "Continuar con Google" button in Spanish and triggers OAuth redirect flow', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    const botonGoogle = screen.getByRole('button', { name: /Continuar con Google/i });
    expect(botonGoogle).toBeInTheDocument();
    expect(screen.queryByText(/Sign In/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Clerk/i)).not.toBeInTheDocument();

    fireEvent.click(botonGoogle);

    expect(mockAuthenticateWithRedirect).toHaveBeenCalledTimes(1);
    expect(mockAuthenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/reservas'
    });
  });

  it('disables "Continuar con Google" button while Clerk is not loaded', () => {
    mockIsLoaded = false;

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    const botonGoogle = screen.getByRole('button', { name: /Continuar con Google/i });
    expect(botonGoogle).toBeDisabled();
  });

  it('displays Spanish error message when Google OAuth redirect fails', async () => {
    mockAuthenticateWithRedirect.mockRejectedValueOnce(new Error('Flujo cancelado por el usuario'));

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    const botonGoogle = screen.getByRole('button', { name: /Continuar con Google/i });
    fireEvent.click(botonGoogle);

    expect(await screen.findByText(/Flujo cancelado por el usuario/i)).toBeInTheDocument();
    expect(botonGoogle).not.toBeDisabled();
  });

  it('re-enables "Continuar con Google" button when restored from bfcache (pageshow persisted=true)', () => {
    mockAuthenticateWithRedirect.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    const botonGoogle = screen.getByRole('button', { name: /Continuar con Google/i });
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

  it('re-enables "Continuar con Google" button and displays Spanish error after 20s safety timeout', () => {
    vi.useFakeTimers();
    mockAuthenticateWithRedirect.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    const botonGoogle = screen.getByRole('button', { name: /Continuar con Google/i });
    fireEvent.click(botonGoogle);

    expect(botonGoogle).toBeDisabled();
    expect(botonGoogle).toHaveAttribute('aria-busy', 'true');

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(screen.getByText('No se completó el ingreso con Google. Intente de nuevo.')).toBeInTheDocument();
    expect(botonGoogle).not.toBeDisabled();
    expect(botonGoogle).toHaveAttribute('aria-busy', 'false');

    vi.useRealTimers();
  });

  it('authenticates local user and stores JWT token and user in localStorage', async () => {
    const payload = {
      id: 2,
      nombre: 'David López',
      email: 'david@utnfrc.edu.ar',
      rol: 'usuario'
    };
    const fakeToken = `header.${btoa(JSON.stringify(payload))}.signature`;

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: fakeToken, usuario: payload })
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { name: 'email', value: 'david@utnfrc.edu.ar' }
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { name: 'password', value: 'user123' }
    });

    fireEvent.click(screen.getByRole('button', { name: /^Ingresar$/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'david@utnfrc.edu.ar', password: 'user123' })
        })
      );
    });

    expect(localStorage.getItem('token')).toBe(fakeToken);
    expect(JSON.parse(localStorage.getItem('usuario'))).toMatchObject({
      email: 'david@utnfrc.edu.ar',
      rol: 'usuario'
    });
  });

  it('displays error message when local login credentials are invalid', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Credenciales inválidas' })
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { name: 'email', value: 'david@utnfrc.edu.ar' }
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { name: 'password', value: 'clave_incorrecta' }
    });

    fireEvent.click(screen.getByRole('button', { name: /^Ingresar$/i }));

    expect(await screen.findByText(/Credenciales inválidas/i)).toBeInTheDocument();
  });
});
