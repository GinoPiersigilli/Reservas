import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EsperaDeSesion from '../EsperaDeSesion.jsx';
import { LIMITE_DE_ESPERA_MS } from '../../hooks/useLimiteDeEspera.js';

/**
 * Las rutas protegidas mostraban `Cargando…` mientras Clerk no contestara, sin
 * límite de tiempo. Con la conexión cortada esa pantalla se quedaba así para
 * siempre: ni un enlace, ni un botón, ni forma de volver al ingreso.
 */

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate
}));

const montar = () =>
  render(
    <MemoryRouter>
      <EsperaDeSesion />
    </MemoryRouter>
  );

/** Corre el reloj hasta pasado el límite, como si el servicio nunca contestara. */
const esperarDeMas = () => {
  act(() => {
    vi.advanceTimersByTime(LIMITE_DE_ESPERA_MS + 1000);
  });
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockNavigate.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EsperaDeSesion', () => {
  it('mientras la espera es razonable solo avisa que está verificando', () => {
    montar();

    expect(screen.getByRole('status')).toHaveTextContent(/verificando/i);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('al vencerse el límite deja de ser una pantalla sin salida', () => {
    montar();
    esperarDeMas();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /no se pudo verificar/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });

  it('ofrece volver al ingreso, que sigue sirviendo aunque Clerk no responda', () => {
    montar();
    esperarDeMas();

    screen.getByRole('button', { name: /ingreso/i }).click();

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('no se rinde antes de tiempo', () => {
    montar();

    act(() => {
      vi.advanceTimersByTime(LIMITE_DE_ESPERA_MS - 1000);
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
