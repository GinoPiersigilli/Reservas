import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from '../AppShell.jsx';
import * as AuthContextModule from '../../context/AuthContext.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: vi.fn()
}));

describe('AppShell layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra Reservas y Nueva reserva pero oculta el destino Panel para un usuario común', () => {
    const cerrarSesion = vi.fn();
    AuthContextModule.useAuth.mockReturnValue({
      usuario: { id: 2, nombre: 'David López', email: 'david@utnfrc.edu.ar', rol: 'usuario' },
      cerrarSesion
    });

    render(
      <MemoryRouter initialEntries={['/reservas']}>
        <AppShell>
          <div>Contenido de prueba</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Reservas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nueva reserva' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Panel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Aulas' })).not.toBeInTheDocument();
    expect(screen.getByText('David López')).toBeInTheDocument();
    expect(screen.getByText('Usuario')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(cerrarSesion).toHaveBeenCalledTimes(1);
  });

  it('muestra el destino Panel cuando el usuario es administrador', () => {
    AuthContextModule.useAuth.mockReturnValue({
      usuario: { id: 1, nombre: 'Admin UTN', email: 'admin@utnfrc.edu.ar', rol: 'admin' },
      cerrarSesion: vi.fn()
    });

    render(
      <MemoryRouter initialEntries={['/reservas']}>
        <AppShell>
          <div>Contenido admin</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Panel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aulas' })).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
  });

  it('muestra el conmutador de tema accesible con aria-pressed y conmuta entre claro y oscuro', () => {
    AuthContextModule.useAuth.mockReturnValue({
      usuario: { id: 1, nombre: 'Admin UTN', email: 'admin@utnfrc.edu.ar', rol: 'admin' },
      cerrarSesion: vi.fn()
    });

    render(
      <MemoryRouter initialEntries={['/reservas']}>
        <AppShell>
          <div>Contenido</div>
        </AppShell>
      </MemoryRouter>
    );

    // Encuentra los botones de conmutador de tema (sidebar desktop y barra móvil)
    const botonesTema = screen.getAllByRole('button', { name: 'Cambiar a modo oscuro' });
    expect(botonesTema.length).toBeGreaterThanOrEqual(1);

    const botonDesktop = botonesTema[0];
    expect(botonDesktop).toHaveAttribute('aria-pressed', 'false');

    // Conmuta a modo oscuro
    fireEvent.click(botonDesktop);

    const botonesTemaOscuro = screen.getAllByRole('button', { name: 'Cambiar a modo claro' });
    expect(botonesTemaOscuro.length).toBeGreaterThanOrEqual(1);
    expect(botonesTemaOscuro[0]).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Conmuta de vuelta a modo claro
    fireEvent.click(botonesTemaOscuro[0]);
    const botonesTemaClaro = screen.getAllByRole('button', { name: 'Cambiar a modo oscuro' });
    expect(botonesTemaClaro[0]).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

