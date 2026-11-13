// src/routes/docs.routes.js
import express from 'express';
import openapi from '../docs/openapi.js';

/**
 * Documentación navegable de la API, montada solo fuera de producción
 * (ver `app.js`).
 *
 * Swagger UI se sirve desde `swagger-ui-dist`, declarado como dependencia de
 * **desarrollo**: así la interfaz funciona sin conexión y sin cargar scripts de
 * terceros, y no entra en la imagen de producción, que se construye con
 * `npm ci --omit=dev`. El módulo se resuelve en el primer pedido y no al
 * importar este archivo, de modo que su ausencia no impida arrancar la API: en
 * ese caso la especificación en JSON sigue disponible.
 */
const PAGINA = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API de Reservas — documentación</title>
    <link rel="stylesheet" href="./swagger-ui/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="./swagger-ui/swagger-ui-bundle.js"></script>
    <script>
      window.SwaggerUIBundle({
        url: '../openapi.json',
        dom_id: '#swagger',
        deepLinking: true,
        tryItOutEnabled: true
      });
    </script>
  </body>
</html>
`;

let estaticoSwagger;

/** Devuelve el middleware estático de Swagger UI, o null si no está instalado. */
const resolverSwaggerUi = async () => {
  if (estaticoSwagger !== undefined) return estaticoSwagger;

  try {
    const { getAbsoluteFSPath } = await import('swagger-ui-dist');
    estaticoSwagger = express.static(getAbsoluteFSPath(), { index: false });
  } catch {
    estaticoSwagger = null;
  }

  return estaticoSwagger;
};

const router = express.Router();

router.get('/openapi.json', (_req, res) => res.json(openapi));

router.use('/ui/swagger-ui', async (req, res, next) => {
  const estatico = await resolverSwaggerUi();
  if (!estatico) {
    return res.status(404).json({ error: 'La interfaz de documentación no está instalada' });
  }
  return estatico(req, res, next);
});

router.get('/ui', async (_req, res) => {
  const estatico = await resolverSwaggerUi();
  if (!estatico) return res.redirect('../openapi.json');
  return res.type('html').send(PAGINA);
});

router.get('/', (_req, res) => res.redirect('./docs/ui'));

export default router;
