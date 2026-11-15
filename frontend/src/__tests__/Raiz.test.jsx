import { render, screen } from '@testing-library/react';
import Raiz from '../Raiz.jsx';

/**
 * Sin `VITE_CLERK_PUBLISHABLE_KEY`, la aplicación mostraba una página en blanco:
 * `ClerkProvider` lanzaba durante el render y el único rastro quedaba en la
 * consola del navegador. Es lo primero que veía quien clonaba el repositorio.
 */

vi.mock('./App.jsx', () => ({ default: () => <p>aplicación montada</p> }));

describe('Raiz sin la clave de Clerk', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('avisa qué falta en lugar de dejar la pantalla vacía', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');

    const { container } = render(<Raiz />);

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByRole('heading', { name: /falta configurar/i })).toBeInTheDocument();
  });

  it('nombra la variable que falta, no solo que algo falló', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');

    render(<Raiz />);

    expect(screen.getByText(/VITE_CLERK_PUBLISHABLE_KEY/)).toBeInTheDocument();
    expect(screen.getByText(/frontend\/\.env\.example/)).toBeInTheDocument();
  });

  it('ofrece una acción, para que la pantalla no sea un callejón sin salida', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');

    render(<Raiz />);

    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument();
  });
});
