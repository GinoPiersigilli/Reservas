// src/middleware/auth.middleware.js
import jwt from 'jsonwebtoken';

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8081';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'reservas-aulas';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'reservas-aulas-client';
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_super_segura_dds_2026';

const issuer = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}`;
const jwksUri = `${issuer}/protocol/openid-connect/certs`;

let jose;
let JWKS;

const getJose = async () => {
  if (!jose) {
    jose = await import('jose');
  }
  if (!JWKS) {
    JWKS = jose.createRemoteJWKSet(new URL(jwksUri));
  }
  return jose;
};

export const verificarToken = async (req, res, next) => {
  const authorization = req.get('authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Token no informado' });
  }

  const token = authorization.substring(7);

  try {
    if (process.env.NODE_ENV !== 'test') {
      const { jwtVerify } = await getJose();
      const { payload } = await jwtVerify(token, JWKS, {
        issuer
      });

      req.usuario = {
        id: payload.sub,
        nombre: payload.given_name || payload.preferred_username,
        email: payload.email,
        rol: payload.realm_access?.roles?.includes('admin') ? 'admin' : 'usuario'
      };

      return next();
    }

    throw new Error('skip keycloak verification in test');
  } catch (error) {
    if (process.env.NODE_ENV === 'test') {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.usuario = {
          id: payload.id,
          nombre: payload.nombre,
          email: payload.email,
          rol: payload.rol
        };
        return next();
      } catch (localError) {
        // fall through to invalid token response
      }
    }

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