import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from '../Register.jsx';
import * as authService from '../../services/auth.service.js';

vi.mock('../../services/auth.service.js', () => ({
  register: vi.fn()
}));

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the registration form', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Contraseña$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmar contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrarse/i })).toBeInTheDocument();
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
    fireEvent.input(screen.getByLabelText(/Email/i), {
      target: { name: 'email', value: 'test@example.com' }
    });
    fireEvent.input(screen.getByLabelText(/^Contraseña$/i), {
      target: { name: 'password', value: '123456' }
    });
    fireEvent.input(screen.getByLabelText(/Confirmar contraseña/i), {
      target: { name: 'confirmPassword', value: '123456' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Registrarse/i }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith('Usuario de prueba', 'test@example.com', '123456');
    });
  });

  it('displays an error message when registration fails', async () => {
    authService.register.mockRejectedValueOnce({ response: { data: { error: 'Email ya registrado' } } });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.input(screen.getByLabelText(/Nombre completo/i), {
      target: { name: 'nombre', value: 'Usuario de prueba' }
    });
    fireEvent.input(screen.getByLabelText(/Email/i), {
      target: { name: 'email', value: 'existing@example.com' }
    });
    fireEvent.input(screen.getByLabelText(/^Contraseña$/i), {
      target: { name: 'password', value: '123456' }
    });
    fireEvent.input(screen.getByLabelText(/Confirmar contraseña/i), {
      target: { name: 'confirmPassword', value: '123456' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Registrarse/i }));

    expect(await screen.findByText(/Email ya registrado/i)).toBeInTheDocument();
  });
});
