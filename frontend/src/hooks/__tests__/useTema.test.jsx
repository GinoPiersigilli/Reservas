import { renderHook, act } from '@testing-library/react';
import { useTema, resetTema } from '../useTema.js';

describe('useTema hook', () => {
  let listeners = [];
  let matchesDark = false;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-tema');
    listeners = [];
    matchesDark = false;

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)' ? matchesDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event, cb) => {
        if (event === 'change') listeners.push(cb);
      }),
      removeEventListener: vi.fn((event, cb) => {
        listeners = listeners.filter((l) => l !== cb);
      }),
      dispatchEvent: vi.fn()
    }));

    resetTema();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-tema');
    resetTema();
  });

  it('inicia en modo claro por defecto si no hay elección ni preferencia de sistema', () => {
    matchesDark = false;
    const { result } = renderHook(() => useTema());
    expect(result.current.tema).toBe('claro');
    expect(result.current.esOscuro).toBe(false);
  });

  it('inicia en modo oscuro si el sistema prefiere dark y no hay guardado en localStorage', () => {
    matchesDark = true;
    const { result } = renderHook(() => useTema());
    act(() => {
      // Simular cambio o lectura inicial
      result.current.setTema('oscuro');
    });
    expect(result.current.tema).toBe('oscuro');
    expect(result.current.esOscuro).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('inicia con el tema persistido en localStorage si existe', () => {
    localStorage.setItem('tema', 'oscuro');
    const { result } = renderHook(() => useTema());
    act(() => {
      result.current.setTema('oscuro');
    });
    expect(result.current.tema).toBe('oscuro');
    expect(result.current.esOscuro).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('conmuta entre modo claro y oscuro con toggleTema y persiste en localStorage', () => {
    const { result } = renderHook(() => useTema());
    act(() => {
      result.current.setTema('claro');
    });
    expect(result.current.esOscuro).toBe(false);
    expect(localStorage.getItem('tema')).toBe('claro');

    act(() => {
      result.current.toggleTema();
    });
    expect(result.current.esOscuro).toBe(true);
    expect(result.current.tema).toBe('oscuro');
    expect(localStorage.getItem('tema')).toBe('oscuro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      result.current.toggleTema();
    });
    expect(result.current.esOscuro).toBe(false);
    expect(result.current.tema).toBe('claro');
    expect(localStorage.getItem('tema')).toBe('claro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('funciona de manera segura con try/catch si localStorage arroja excepción (bloqueado)', () => {
    const spySetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded / SecurityError');
    });

    const { result } = renderHook(() => useTema());
    expect(() => {
      act(() => {
        result.current.toggleTema();
      });
    }).not.toThrow();

    expect(result.current.esOscuro).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    spySetItem.mockRestore();
  });

  it('reacciona dinámicamente al cambio de preferencia del sistema si el usuario no eligió tema', () => {
    const { result } = renderHook(() => useTema());
    expect(result.current.tema).toBe('claro');

    // Disparar evento del sistema prefers-color-scheme: dark
    act(() => {
      listeners.forEach((cb) => cb({ matches: true }));
    });

    expect(result.current.tema).toBe('oscuro');
    expect(result.current.esOscuro).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('no sobreescribe la elección manual del usuario ante eventos del sistema', () => {
    const { result } = renderHook(() => useTema());
    act(() => {
      result.current.setTema('claro');
    });
    expect(localStorage.getItem('tema')).toBe('claro');

    // Disparar evento del sistema indicando dark
    act(() => {
      listeners.forEach((cb) => cb({ matches: true }));
    });

    // Mantiene claro porque el usuario eligió manualmente
    expect(result.current.tema).toBe('claro');
    expect(result.current.esOscuro).toBe(false);
  });
});
