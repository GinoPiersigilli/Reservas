import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { verificarParesTokens } from '../../../scripts/verificar-contraste.js';
import AppShell from '../../components/AppShell.jsx';
import Login from '../Login.jsx';
import Register from '../Register.jsx';
import Reservas from '../Reservas.jsx';
import FormularioReserva from '../FormularioReserva.jsx';
import DetalleReserva from '../DetalleReserva.jsx';
import Resumen from '../Resumen.jsx';
import Aulas from '../Aulas.jsx';
import NotFound from '../NotFound.jsx';
import * as AuthContextModule from '../../context/AuthContext.jsx';
import * as aulaService from '../../services/aula.service.js';
import * as reservasService from '../../services/reservas.service.js';

vi.mock('@clerk/clerk-react', () => ({
  SignIn: () => <div data-testid="clerk-signin">Clerk SignIn</div>,
  SignUp: () => <div data-testid="clerk-signup">Clerk SignUp</div>,
  useSignIn: () => ({ isLoaded: true, signIn: { authenticateWithRedirect: vi.fn() } }),
  useSignUp: () => ({ isLoaded: true, signUp: { authenticateWithRedirect: vi.fn() } }),
  AuthenticateWithRedirectCallback: () => null
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: vi.fn()
}));

vi.mock('../../services/aula.service.js', () => ({
  getAulas: vi.fn(),
  getDisponibilidadAula: vi.fn()
}));

vi.mock('../../services/reservas.service.js', () => ({
  getReservas: vi.fn(),
  getReserva: vi.fn(),
  getHistorial: vi.fn(),
  getResumen: vi.fn(),
  crearReserva: vi.fn(),
  editarReserva: vi.fn(),
  aprobarReserva: vi.fn(),
  rechazarReserva: vi.fn(),
  cancelarReserva: vi.fn()
}));

const aulasMock = [
  { id: 1, nombre: 'Aula 910', ubicacion: 'Piso 1', capacidad: 45, activa: true },
  { id: 2, nombre: 'Laboratorio A6', ubicacion: 'PB', capacidad: 30, activa: true }
];

const reservaDetalleMock = {
  id: 25,
  aulaId: 1,
  aula: { nombre: 'Aula 910' },
  usuarioId: 2,
  usuario: { nombre: 'David Usuario' },
  fecha: '2027-11-20',
  horaInicio: '10:00',
  horaFin: '12:00',
  cantidadPersonas: 25,
  motivo: 'Parcial de Física',
  estado: 'pendiente',
  createdAt: '2026-11-07T12:00:00.000Z',
  updatedAt: '2026-11-07T12:00:00.000Z'
};

function sinViolacionesAxe(resultadosAxe) {
  const violaciones = resultadosAxe.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.html).join(' | ')}`
  );
  expect(violaciones).toEqual([]);
}

describe('Fase 3b-4 — Accesibilidad (axe, teclado, contraste) y Estados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AuthContextModule.useAuth.mockReturnValue({
      usuario: { id: 1, nombre: 'Admin UTN', email: 'admin@utnfrc.edu.ar', rol: 'admin' },
      iniciarSesionLocal: vi.fn(),
      cerrarSesion: vi.fn()
    });
    aulaService.getAulas.mockResolvedValue({ data: aulasMock });
    aulaService.getDisponibilidadAula.mockResolvedValue({ data: [] });
  });

  it('verifies all color pairs in tokens.css meet WCAG AA and match Section 3 of DISENO_PROPUESTA.md', () => {
    const resultados = verificarParesTokens();
    expect(resultados.length).toBeGreaterThanOrEqual(10);
    for (const par of resultados) {
      expect(par.cumpleAA).toBe(true);
      expect(par.coincidePropuesta).toBe(true);
    }
  });

  it('verifies all dark mode color pairs in tokens.css meet WCAG AA', () => {
    const resultados = verificarParesTokens('oscuro');
    expect(resultados.length).toBeGreaterThanOrEqual(10);
    for (const par of resultados) {
      expect(par.cumpleAA).toBe(true);
      expect(par.coincidePropuesta).toBe(true);
    }
  });

  it('passes axe accessibility audit on Login and Register screens', async () => {
    const { container: loginContainer, unmount: unmountLogin } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    sinViolacionesAxe(await axe(loginContainer));
    unmountLogin();

    const { container: registerContainer } = render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    sinViolacionesAxe(await axe(registerContainer));
  });

  it('passes axe accessibility audit on main screens in dark theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    try {
      const { container: loginContainer, unmount: unmountLogin } = render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
      sinViolacionesAxe(await axe(loginContainer));
      unmountLogin();

      const { container: registerContainer, unmount: unmountRegister } = render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );
      sinViolacionesAxe(await axe(registerContainer));
      unmountRegister();

      reservasService.getReservas.mockResolvedValueOnce({
        data: {
          data: [reservaDetalleMock],
          pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
        }
      });
      const { container: cReservas, unmount: uReservas } = render(
        <MemoryRouter initialEntries={['/reservas']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/reservas" element={<Reservas />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      await screen.findByText('Parcial de Física');
      sinViolacionesAxe(await axe(cReservas));
      uReservas();
    } finally {
      document.documentElement.removeAttribute('data-theme');
    }
  });

  it('passes axe accessibility audit on AppShell + Reservas, FormularioReserva, DetalleReserva, Resumen, and NotFound', async () => {
    reservasService.getReservas.mockResolvedValue({
      data: {
        data: [reservaDetalleMock],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
      }
    });
    reservasService.getReserva.mockResolvedValue({ data: reservaDetalleMock });
    reservasService.getHistorial.mockResolvedValue({
      data: [
        {
          id: 1,
          accion: 'creada',
          usuarioId: 2,
          fechaHora: '2026-11-07T12:00:00.000Z',
          valorAnterior: null,
          valorNuevo: { estado: 'pendiente' }
        }
      ]
    });
    reservasService.getResumen.mockResolvedValue({
      data: {
        porEstado: [{ estado: 'pendiente', total: 1 }],
        porAula: [{ aulaId: 1, total: 3 }],
        proximasHoy: [reservaDetalleMock]
      }
    });

    // 1. AppShell + Reservas
    const { container: cReservas, unmount: uReservas } = render(
      <MemoryRouter initialEntries={['/reservas']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/reservas" element={<Reservas />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('Parcial de Física');
    sinViolacionesAxe(await axe(cReservas));
    uReservas();

    // 2. AppShell + FormularioReserva + GrillaDisponibilidad
    const { container: cForm, unmount: uForm } = render(
      <MemoryRouter initialEntries={['/reservas/nueva']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/reservas/nueva" element={<FormularioReserva />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('button', { name: /Aula 910, 08:00 a 08:30, libre/i });
    sinViolacionesAxe(await axe(cForm));
    uForm();

    // 3. AppShell + DetalleReserva
    const { container: cDetalle, unmount: uDetalle } = render(
      <MemoryRouter initialEntries={['/reservas/25']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/reservas/:id" element={<DetalleReserva />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /Reserva #25/i });
    sinViolacionesAxe(await axe(cDetalle));
    uDetalle();

    // 4. AppShell + Resumen (Panel)
    const { container: cResumen, unmount: uResumen } = render(
      <MemoryRouter initialEntries={['/resumen']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/resumen" element={<Resumen />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /Pendientes de aprobación/i });
    sinViolacionesAxe(await axe(cResumen));
    uResumen();

    // 5. NotFound (404)
    const { container: c404, unmount: u404 } = render(
      <MemoryRouter initialEntries={['/ruta-inexistente']}>
        <NotFound />
      </MemoryRouter>
    );
    sinViolacionesAxe(await axe(c404));
    u404();

    // 6. AppShell + Aulas
    const { container: cAulas, unmount: uAulas } = render(
      <MemoryRouter initialEntries={['/aulas']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/aulas" element={<Aulas />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /^Aulas$/i });
    sinViolacionesAxe(await axe(cAulas));
    uAulas();
  }, 30000);

  it('supports keyboard navigation with arrow keys in GrillaDisponibilidad and focus trap + Escape in ConfirmDialog', async () => {
    render(
      <MemoryRouter>
        <FormularioReserva />
      </MemoryRouter>
    );

    const celda0800 = await screen.findByRole('button', {
      name: /Aula 910, 08:00 a 08:30, libre/i
    });
    const celda0830 = screen.getByRole('button', {
      name: /Aula 910, 08:30 a 09:00, libre/i
    });
    const celdaAula2 = screen.getByRole('button', {
      name: /Laboratorio A6, 08:30 a 09:00, libre/i
    });

    celda0800.focus();
    expect(celda0800).toHaveFocus();

    fireEvent.keyDown(celda0800, { key: 'ArrowRight' });
    expect(celda0830).toHaveFocus();

    fireEvent.keyDown(celda0830, { key: 'ArrowDown' });
    expect(celdaAula2).toHaveFocus();

    // Ahora verificamos ConfirmDialog en DetalleReserva: foco atrapado, Escape cierra y devuelve foco
    reservasService.getReserva.mockResolvedValueOnce({ data: reservaDetalleMock });
    reservasService.getHistorial.mockResolvedValueOnce({ data: [] });

    render(
      <MemoryRouter initialEntries={['/reservas/25']}>
        <Routes>
          <Route path="/reservas/:id" element={<DetalleReserva />} />
        </Routes>
      </MemoryRouter>
    );

    const botonRechazar = await screen.findByRole('button', { name: /^Rechazar$/i });
    botonRechazar.focus();
    fireEvent.click(botonRechazar);

    const dialogo = await screen.findByRole('dialog');
    const botonCancelarDialogo = within(dialogo).getByRole('button', { name: /^Cancelar$/i });
    expect(botonCancelarDialogo).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(botonRechazar).toHaveFocus();
  });

  it('renders error states with retry button when network fails on DetalleReserva and Resumen', async () => {
    reservasService.getReserva.mockRejectedValueOnce({
      response: { data: { error: 'Fallo de red al cargar detalle' } }
    });
    reservasService.getHistorial.mockRejectedValueOnce(new Error('Network error'));

    const { unmount } = render(
      <MemoryRouter initialEntries={['/reservas/25']}>
        <Routes>
          <Route path="/reservas/:id" element={<DetalleReserva />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Fallo de red al cargar detalle/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
    unmount();

    reservasService.getResumen.mockRejectedValueOnce({
      response: { data: { error: 'Fallo de red en el panel' } }
    });

    render(
      <MemoryRouter>
        <Resumen />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Fallo de red en el panel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });
});
