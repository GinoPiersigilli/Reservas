import { renderHook, act } from '@testing-library/react';
import { useIngreso } from '../useIngreso.js';

/**
 * Hasta esta fase el formulario de ingreso solo preguntaba a la base propia, y
 * quien se había registrado por Clerk no podía volver a entrar: su fila local
 * existe pero con `passwordHash` nulo, así que `POST /auth/login` la rechazaba
 * con «credenciales inválidas» aunque la contraseña fuera la correcta.
 *
 * Lo que se prueba acá es que se consulten las dos vías, en el orden acordado, y
 * que ninguna de las dos quede inalcanzable por culpa de la otra.
 */

const mockCreate = vi.fn();
const mockSetActive = vi.fn();
const mockIniciarSesionLocal = vi.fn();
let mockIsLoaded = true;

vi.mock('@clerk/clerk-react', () => ({
  useSignIn: () => ({
    isLoaded: mockIsLoaded,
    setActive: mockSetActive,
    signIn: { create: mockCreate }
  })
}));

vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ iniciarSesionLocal: mockIniciarSesionLocal })
}));

const CREDENCIALES = { email: 'santi@example.com', password: 'secreta123' };

/** Clerk rechaza con un error con forma de respuesta suya, no de corte de red. */
const rechazoDeClerk = () =>
  Object.assign(new Error('form_password_incorrect'), {
    errors: [{ code: 'form_password_incorrect', message: 'Password is incorrect' }]
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoaded = true;
});

describe('useIngreso', () => {
  it('entra por Clerk sin tocar la vía local cuando Clerk acepta', async () => {
    mockCreate.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_1' });
    const alIngresar = vi.fn();

    const { result } = renderHook(() => useIngreso({ alIngresar }));
    await act(async () => {
      await result.current.ingresar(CREDENCIALES);
    });

    expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_1' });
    expect(mockIniciarSesionLocal).not.toHaveBeenCalled();
    expect(alIngresar).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('cae a la vía local cuando Clerk no reconoce las credenciales', async () => {
    mockCreate.mockRejectedValue(rechazoDeClerk());
    mockIniciarSesionLocal.mockResolvedValue(undefined);
    const alIngresar = vi.fn();

    const { result } = renderHook(() => useIngreso({ alIngresar }));
    await act(async () => {
      await result.current.ingresar(CREDENCIALES);
    });

    expect(mockIniciarSesionLocal).toHaveBeenCalledWith(CREDENCIALES.email, CREDENCIALES.password);
    expect(alIngresar).toHaveBeenCalled();
  });

  it('las cuentas semilla entran aunque Clerk no haya cargado', async () => {
    mockIsLoaded = false;
    mockIniciarSesionLocal.mockResolvedValue(undefined);

    const { result } = renderHook(() => useIngreso({}));
    await act(async () => {
      await result.current.ingresar({ email: 'admin@utn.edu.ar', password: 'admin123' });
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockIniciarSesionLocal).toHaveBeenCalled();
  });

  it('un corte de conexión con Clerk no deja afuera a la vía local', async () => {
    mockCreate.mockRejectedValue(new TypeError('Failed to fetch'));
    mockIniciarSesionLocal.mockResolvedValue(undefined);

    const { result } = renderHook(() => useIngreso({}));
    await act(async () => {
      await result.current.ingresar({ email: 'admin@utn.edu.ar', password: 'admin123' });
    });

    expect(mockIniciarSesionLocal).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('muestra el error cuando ninguna de las dos vías reconoce las credenciales', async () => {
    mockCreate.mockRejectedValue(rechazoDeClerk());
    mockIniciarSesionLocal.mockRejectedValue(new Error('Credenciales inválidas'));
    const alIngresar = vi.fn();

    const { result } = renderHook(() => useIngreso({ alIngresar }));
    await act(async () => {
      await result.current.ingresar(CREDENCIALES);
    });

    expect(result.current.error).toBe('Credenciales inválidas');
    expect(alIngresar).not.toHaveBeenCalled();
  });

  it('no reintenta contra la base propia si Clerk aceptó pero pide otro factor', async () => {
    mockCreate.mockResolvedValue({ status: 'needs_second_factor' });

    const { result } = renderHook(() => useIngreso({}));
    await act(async () => {
      await result.current.ingresar(CREDENCIALES);
    });

    // La contraseña era correcta: rebotarla contra la base diría una mentira.
    expect(mockIniciarSesionLocal).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/verificación/i);
  });
});
