import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RutaProtegida from '../RutaProtegida.jsx';
import RutaSoloAdmin from '../RutaSoloAdmin.jsx';

/**
 * La guarda era `if (!isLoaded)` a secas, antes de mirar si había sesión local.
 * Con Clerk caído eso encerraba a quien hubiera entrado con una cuenta local, y
 * lo encerraba justo donde la pantalla de espera le ofrecía «ir al ingreso»:
 * entraba, volvía, y se topaba otra vez con la misma espera.
 */

let mockClerk = { isLoaded: true, isSignedIn: false };
let mockAuth = { usuario: null, cargandoPerfil: false };

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => mockClerk
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth
}));

const montar = (Ruta = RutaProtegida) =>
  render(
    <MemoryRouter>
      <Ruta>
        <p>contenido protegido</p>
      </Ruta>
    </MemoryRouter>
  );

const USUARIO_LOCAL = { id: 3, nombre: 'Admin', rol: 'admin' };

beforeEach(() => {
  mockClerk = { isLoaded: true, isSignedIn: false };
  mockAuth = { usuario: null, cargandoPerfil: false };
});

describe('RutaProtegida con Clerk caído', () => {
  it('deja pasar a quien tiene sesión local, sin esperar a Clerk', () => {
    mockClerk = { isLoaded: false, isSignedIn: false };
    mockAuth = { usuario: USUARIO_LOCAL, cargandoPerfil: false };

    montar();

    expect(screen.getByText('contenido protegido')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('sigue esperando cuando no hay ninguna sesión que valga', () => {
    mockClerk = { isLoaded: false, isSignedIn: false };

    montar();

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('espera mientras viaja el perfil de una sesión de Clerk', () => {
    mockClerk = { isLoaded: true, isSignedIn: true };
    mockAuth = { usuario: null, cargandoPerfil: true };

    montar();

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('no deja pasar con usuario null aunque Clerk indique isSignedIn si falló la carga del perfil', () => {
    mockClerk = { isLoaded: true, isSignedIn: true };
    mockAuth = { usuario: null, cargandoPerfil: false };

    montar();

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('RutaSoloAdmin', () => {
  it('deja pasar al administrador local aunque Clerk no responda', () => {
    mockClerk = { isLoaded: false, isSignedIn: false };
    mockAuth = { usuario: USUARIO_LOCAL, cargandoPerfil: false };

    montar(RutaSoloAdmin);

    expect(screen.getByText('contenido protegido')).toBeInTheDocument();
  });

  /** El rol sale de la fila de PostgreSQL, no de `publicMetadata`. */
  it('no deja pasar a quien no es administrador en la base', () => {
    mockClerk = { isLoaded: true, isSignedIn: true };
    mockAuth = { usuario: { id: 7, rol: 'usuario' }, cargandoPerfil: false };

    montar(RutaSoloAdmin);

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
  });
});
