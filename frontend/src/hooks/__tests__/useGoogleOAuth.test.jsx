import { renderHook, act } from '@testing-library/react';
import { useGoogleOAuth } from '../useGoogleOAuth.js';

describe('useGoogleOAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() =>
      useGoogleOAuth({
        authResource: { authenticateWithRedirect: vi.fn() },
        isLoaded: true
      })
    );

    expect(result.current.redirigiendoGoogle).toBe(false);
    expect(result.current.errorGoogle).toBeNull();
  });

  it('sets redirigiendoGoogle=true when initiating OAuth', async () => {
    let resolveAuth;
    const mockAuth = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveAuth = resolve; }));

    const { result } = renderHook(() =>
      useGoogleOAuth({
        authResource: { authenticateWithRedirect: mockAuth },
        isLoaded: true
      })
    );

    act(() => {
      result.current.iniciarOAuth();
    });

    expect(result.current.redirigiendoGoogle).toBe(true);
    expect(mockAuth).toHaveBeenCalledTimes(1);

    resolveAuth?.();
  });

  it('re-enables loading state when window receives pageshow event with persisted=true (bfcache)', async () => {
    const mockAuth = vi.fn().mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useGoogleOAuth({
        authResource: { authenticateWithRedirect: mockAuth },
        isLoaded: true
      })
    );

    act(() => {
      result.current.iniciarOAuth();
    });
    expect(result.current.redirigiendoGoogle).toBe(true);

    act(() => {
      const event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', { value: true });
      window.dispatchEvent(event);
    });

    expect(result.current.redirigiendoGoogle).toBe(false);
  });

  it('re-enables loading state when document visibility changes to visible', async () => {
    const mockAuth = vi.fn().mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useGoogleOAuth({
        authResource: { authenticateWithRedirect: mockAuth },
        isLoaded: true
      })
    );

    act(() => {
      result.current.iniciarOAuth();
    });
    expect(result.current.redirigiendoGoogle).toBe(true);

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.redirigiendoGoogle).toBe(false);
  });

  it('resets loading state and displays Spanish error after 20 seconds safety timeout', () => {
    vi.useFakeTimers();
    const mockAuth = vi.fn().mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useGoogleOAuth({
        authResource: { authenticateWithRedirect: mockAuth },
        isLoaded: true,
        timeoutMs: 20000
      })
    );

    act(() => {
      result.current.iniciarOAuth();
    });
    expect(result.current.redirigiendoGoogle).toBe(true);
    expect(result.current.errorGoogle).toBeNull();

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(result.current.redirigiendoGoogle).toBe(false);
    expect(result.current.errorGoogle).toBe('No se completó el ingreso con Google. Intente de nuevo.');

    vi.useRealTimers();
  });

  it('sets error and resets loading state when authenticateWithRedirect throws', async () => {
    const mockAuth = vi.fn().mockRejectedValueOnce(new Error('Acceso cancelado'));

    const { result } = renderHook(() =>
      useGoogleOAuth({
        authResource: { authenticateWithRedirect: mockAuth },
        isLoaded: true
      })
    );

    await act(async () => {
      await result.current.iniciarOAuth();
    });

    expect(result.current.redirigiendoGoogle).toBe(false);
    expect(result.current.errorGoogle).toBe('Acceso cancelado');
  });

  it('cleans up event listeners and timer on unmount', () => {
    vi.useFakeTimers();
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const docRemoveEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const mockAuth = vi.fn().mockImplementation(() => new Promise(() => {}));
    const { result, unmount } = renderHook(() =>
      useGoogleOAuth({
        authResource: { authenticateWithRedirect: mockAuth },
        isLoaded: true
      })
    );

    act(() => {
      result.current.iniciarOAuth();
    });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('pageshow', expect.any(Function));
    expect(docRemoveEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    // Verify timer doesn't trigger state update after unmount
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    vi.useRealTimers();
  });
});
