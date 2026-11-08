import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from '../Register.jsx';
import * as authService from '../../services/auth.service.js';

const mockAuthenticateWithRedirect = vi.fn();
let mockIsLoaded = true;

vi.mock('@clerk/clerk-react', () => ({
  useSignUp: () => ({
    isLoaded: mockIsLoaded,
    signUp: { authenticateWithRedirect: mockAuthenticateWithRedirect }
  }),
  AuthenticateWithRedirectCallback: () => null
}));

vi.mock('../../services/auth.service.js', () => ({
  register: vi.fn()
}));

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockAuthenticateWithRedirect.mockResolvedValue({});
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

  it('submits the form and calls register service', async () => {
    authService.register.mockResolvedValueOnce({ data: {} });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.input(screen.getByLabelText(/Nombre completo/i), {
      target: { name: 'nombre', value: 'Usuario de prueba' }
    });
    fireEvent.input(screen.getByLabelText(/Correo electrónico/i), {
      target: { name: 'email', value: 'test@example.com' }
    });
    fireEvent.input(screen.getByLabelText(/^Contraseña/i), {
      target: { name: 'password', value: '123456' }
    });
    fireEvent.input(screen.getByLabelText(/Confirmar contraseña/i), {
      target: { name: 'confirmPassword', value: '123456' }
    });

    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/i }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith(
        'Usuario de prueba',
        'test@example.com',
        '123456'
      );
    });
  });

  it('displays an error message when registration fails', async () => {
    authService.register.mockRejectedValueOnce({
      response: { data: { error: 'Email ya registrado' } }
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.input(screen.getByLabelText(/Nombre completo/i), {
      target: { name: 'nombre', value: 'Usuario de prueba' }
    });
    fireEvent.input(screen.getByLabelText(/Correo electrónico/i), {
      target: { name: 'email', value: 'existing@example.com' }
    });
    fireEvent.input(screen.getByLabelText(/^Contraseña/i), {
      target: { name: 'password', value: '123456' }
    });
    fireEvent.input(screen.getByLabelText(/Confirmar contraseña/i), {
      target: { name: 'confirmPassword', value: '123456' }
    });

    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/i }));

    expect(await screen.findByText(/Email ya registrado/i)).toBeInTheDocument();
  });
});
