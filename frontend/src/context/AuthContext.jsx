import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const KEYCLOAK_BASE_URL = 'http://localhost:8081';
const KEYCLOAK_REALM = 'dds-aulas';
const KEYCLOAK_CLIENT_ID = 'dds-aulas-client';
const REDIRECT_URI = 'http://localhost:5173/callback';

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem('usuario');
    return guardado ? JSON.parse(guardado) : null;
  });

  const iniciarLogin = () => {
    const authUrl =
      `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth` +
      `?client_id=${KEYCLOAK_CLIENT_ID}` +
      `&response_type=code` +
      `&scope=openid profile email` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    window.location.href = authUrl;
  };

  const procesarCallback = async (code) => {
    const response = await fetch('http://localhost:3001/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!response.ok) throw new Error('Error al obtener token');

    const data = await response.json();

    const payload = JSON.parse(atob(data.access_token.split('.')[1]));

    const datosUsuario = {
      id: payload.sub,
      nombre: payload.given_name || payload.preferred_username,
      email: payload.email,
      rol: payload.realm_access?.roles?.includes('admin') ? 'admin' : 'usuario'
    };

    localStorage.setItem('token', data.access_token);
    localStorage.setItem('usuario', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);

    return datosUsuario;
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);

    window.location.href =
      `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout` +
      `?post_logout_redirect_uri=${encodeURIComponent('http://localhost:5173/login')}` +
      `&client_id=${KEYCLOAK_CLIENT_ID}`;
  };

  return (
    <AuthContext.Provider value={{ usuario, iniciarLogin, procesarCallback, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);