import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext.jsx';
import Login from '../Login.jsx';

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
  useAuth: () => ({ getToken: vi.fn(), signOut: vi.fn() }),
  SignIn: () => <div data-testid="clerk-signin">Clerk SignIn</div>
}));

describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
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
