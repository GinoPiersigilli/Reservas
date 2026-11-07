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

  it('renders login form fields', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Ingresar$/i }).length).toBeGreaterThanOrEqual(1);
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

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { name: 'email', value: 'david@utnfrc.edu.ar' }
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { name: 'password', value: 'user123' }
    });

    const submitButtons = screen.getAllByRole('button', { name: /Ingresar/i });
    const submitBtn = submitButtons.find((btn) => btn.getAttribute('type') === 'submit');
    fireEvent.click(submitBtn);

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

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { name: 'email', value: 'david@utnfrc.edu.ar' }
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { name: 'password', value: 'clave_incorrecta' }
    });

    const submitButtons = screen.getAllByRole('button', { name: /Ingresar/i });
    const submitBtn = submitButtons.find((btn) => btn.getAttribute('type') === 'submit');
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Credenciales inválidas/i)).toBeInTheDocument();
  });
});
