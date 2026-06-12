// src/middleware/auth.middleware.js
import { createRemoteJWKSet, jwtVerify } from 'jose';

const KEYCLOAK_BASE_URL = 'http://localhost:8081';
const KEYCLOAK_REALM = 'dds-aulas';
const KEYCLOAK_CLIENT_ID = 'dds-aulas-client';

const issuer = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}`;
const jwksUri = `${issuer}/protocol/openid-connect/certs`;
const JWKS = createRemoteJWKSet(new URL(jwksUri));

export const verificarToken = async (req, res, next) => {
  const authorization = req.get('authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Token no informado' });
  }

  const token = authorization.substring(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer
    });

    req.usuario = {
      id: payload.sub,
      nombre: payload.given_name || payload.preferred_username,
      email: payload.email,
      rol: payload.realm_access?.roles?.includes('admin') ? 'admin' : 'usuario'
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Token inválido o expirado'
    });
  }
};

export const soloAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin' });
  }
  next();
};