import { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { registrarGetToken } from '../services/axios.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { user, isLoaded } = useUser();
  const { getToken, signOut } = useClerkAuth();

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

  const usuario = user ? {
    id:     user.id,
    nombre: user.firstName || user.username || user.emailAddresses[0].emailAddress,
    email:  user.emailAddresses[0].emailAddress,
    rol:    user.publicMetadata?.rol || 'usuario'
  } : usuarioLocal;

  const iniciarSesionLocal = async (email, password) => {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');

    const payload = JSON.parse(atob(data.token.split('.')[1]));
    const datosUsuario = {
      id:     payload.id,
      nombre: payload.nombre,
      email:  payload.email,
      rol:    payload.rol
    };

    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(datosUsuario));
    setUsuarioLocal(datosUsuario);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuarioLocal(null);
    registrarGetToken(null);
    if (user) signOut();
    else window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ usuario, isLoaded, iniciarSesionLocal, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);