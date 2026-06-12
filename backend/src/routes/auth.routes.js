import express from 'express';

const router = express.Router();

const KEYCLOAK_BASE_URL = 'http://localhost:8081';
const KEYCLOAK_REALM = 'dds-aulas';
const KEYCLOAK_CLIENT_ID = 'dds-aulas-client';
const REDIRECT_URI = 'http://localhost:5173/callback';

router.get('/login', (req, res) => {
  const authUrl =
    `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth` +
    `?client_id=${KEYCLOAK_CLIENT_ID}` +
    `&response_type=code` +
    `&scope=openid profile email` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  res.json({ loginUrl: authUrl });
});

router.post('/token', async (req, res, next) => {
  try {
    const { code } = req.body;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KEYCLOAK_CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI
    });

    const response = await fetch(
      `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error_description || 'Error al obtener token');
      error.status = 400;
      throw error;
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;