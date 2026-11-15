import { render, screen } from '@testing-library/react';
import LimiteDeError from '../LimiteDeError.jsx';

/**
 * Lo que se prueba acá es que una excepción durante el render **no** deje el
 * documento vacío. Antes de que existiera este componente, cualquier error
 * desmontaba el árbol entero y la persona veía una página en blanco sin forma
 * de salir ni de enterarse de qué pasó.
 */

/** React escribe el error en la consola aunque el límite lo atrape. */
let consolaError;

beforeEach(() => {
  consolaError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consolaError.mockRestore();
});

const Explota = () => {
  throw new Error('fallo de prueba');
};

describe('LimiteDeError', () => {
  it('no estorba cuando no hay error', () => {
    render(
      <LimiteDeError>
        <p>contenido normal</p>
      </LimiteDeError>
    );

    expect(screen.getByText('contenido normal')).toBeInTheDocument();
  });

  it('muestra una pantalla con salida en lugar de dejar el documento vacío', () => {
    const { container } = render(
      <LimiteDeError>
        <Explota />
      </LimiteDeError>
    );

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /no pudo continuar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument();
  });

  it('muestra el mensaje del error, que es el único rastro de qué falló', () => {
    render(
      <LimiteDeError>
        <Explota />
      </LimiteDeError>
    );

    expect(screen.getByText('fallo de prueba')).toBeInTheDocument();
  });
});
