import { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { registrarGetToken, registrarOnUnauthorized } from '../services/axios.js';
import { obtenerPerfil } from '../services/auth.service.js';
import { decodificarPayloadJwt } from '../utils/jwt.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { user, isLoaded } = useUser();
  const { getToken, signOut } = useClerkAuth();

  /**
   * El perfil que devuelve la API, guardado junto al identificador de Clerk que
   * lo pidió. Van juntos para que, al cambiar de cuenta, el perfil de la
   * anterior no se dé por bueno durante el instante que tarda el pedido nuevo.
   */
  const [perfilClerk, setPerfilClerk] = useState(null);
  const [falloPerfil, setFalloPerfil] = useState(null);

  const [usuarioLocal, setUsuarioLocal] = useState(() => {
    const guardado = localStorage.getItem('usuario');
    return guardado ? JSON.parse(guardado) : null;
  });

  useEffect(() => {
    if (user) {
      registrarGetToken(getToken);
    } else if (usuarioLocal) {
      registrarGetToken(() => Promise.resolve(localStorage.getItem('token')));
    } else {
      registrarGetToken(null);
    }
  }, [user, usuarioLocal, getToken]);

  useEffect(() => {
    const handleUnauthorized = async () => {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      setUsuarioLocal(null);
      setPerfilClerk(null);
      setFalloPerfil(null);
      registrarGetToken(null);
      if (user && typeof signOut === 'function') {
        try {
          await signOut();
        } catch {
          return;
        }
      }
    };
    registrarOnUnauthorized(handleUnauthorized);
    return () => {
      registrarOnUnauthorized(null);
    };
  }, [user, signOut]);

  /**
   * Con sesión de Clerk, la identidad se le pregunta a la API propia.
   *
   * Lo que trae el SDK no sirve para operar: `user.id` es la cadena `user_2…`
   * de Clerk y las reservas guardan la clave primaria entera de `usuarios`, así
   * que compararlas no falla, devuelve `false` siempre —y quien entraba por
   * Clerk nunca veía el botón de cancelar su propia reserva—. El rol tiene el
   * mismo problema de fondo: `publicMetadata` es una copia, y la fuente de
   * verdad es PostgreSQL (ver ADR 0002).
   */
  useEffect(() => {
    if (!user) return undefined;

    let cancelado = false;
    obtenerPerfil()
      .then(({ data }) => {
        if (!cancelado) setPerfilClerk({ clerkId: user.id, datos: data });
      })
      .catch(() => {
        if (!cancelado) setFalloPerfil(user.id);
      });

    return () => {
      cancelado = true;
    };
  }, [user]);

  // `user &&` primero: sin sesión de Clerk los dos lados son `undefined` y la
  // comparación daría verdadera sobre un perfil que no existe.
  const perfilVigente = user && perfilClerk?.clerkId === user.id ? perfilClerk.datos : null;
  const falloVigente = Boolean(user) && falloPerfil === user.id;

  /**
   * Mientras el perfil viaja no hay identidad que dar. Devolver una provisoria
   * armada con los datos de Clerk es lo que causaba el problema: decidiría
   * permisos y comparaciones con un identificador que no es el de esta base.
   */
  const cargandoPerfil = Boolean(user) && !perfilVigente && !falloVigente;

  const usuario = user ? perfilVigente : usuarioLocal;

  const iniciarSesionLocal = async (email, password) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');

    const payload = decodificarPayloadJwt(data.token);
    const datosUsuario = {
      id: payload.id,
      nombre: payload.nombre,
      email: payload.email,
      rol: payload.rol
    };

    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(datosUsuario));
    setUsuarioLocal(datosUsuario);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuarioLocal(null);
    setPerfilClerk(null);
    setFalloPerfil(null);
    registrarGetToken(null);
    if (user) signOut();
    else window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{ usuario, isLoaded, cargandoPerfil, iniciarSesionLocal, cerrarSesion }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
