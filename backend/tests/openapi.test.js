import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import openapi from '../src/docs/openapi.js';

/**
 * Recorre las rutas que Express tiene registradas y las devuelve con el mismo
 * formato que usa OpenAPI (`/reservas/{id}`), ya sin el prefijo `/api`.
 */
const rutasRegistradas = () => {
  const encontradas = new Set();

  const recorrer = (capa, prefijo) => {
    if (capa.route) {
      const ruta = `${prefijo}${capa.route.path}`.replace(/\/$/, '') || '/';
      for (const [metodo, activo] of Object.entries(capa.route.methods)) {
        if (activo && metodo !== '_all') encontradas.add(`${metodo.toUpperCase()} ${ruta}`);
      }
      return;
    }

    if (capa.name === 'router' && capa.handle?.stack) {
      // Express guarda el prefijo del router como expresión regular
      // (`^\/api\/reservas\/?(?=\/|$)`): de ahí se recupera la ruta montada.
      const base = (capa.regexp?.source || '')
        .replace(/^\^/, '')
        .replace(/\\\/\?\(\?=\\\/\|\$\)\$?$/, '')
        .replace(/\\\//g, '/');

      for (const hija of capa.handle.stack) recorrer(hija, `${prefijo}${base}`);
    }
  };

  for (const capa of app._router.stack) recorrer(capa, '');

  return [...encontradas]
    .filter((entrada) => entrada.includes(' /api'))
    .map((entrada) =>
      entrada
        .replace(' /api', ' ')
        .replace(/:(\w+)/g, '{$1}')
        .trim()
    )
    .map((entrada) => entrada.replace(/\s+/g, ' '));
};

describe('Documentación OpenAPI', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  it('la especificación es un documento OpenAPI válido', async () => {
    // validate() resuelve las referencias y falla si alguna no existe.
    await expect(SwaggerParser.validate(structuredClone(openapi))).resolves.toBeDefined();
  });

  it('documenta todas las rutas que la API expone', () => {
    const documentadas = new Set();
    for (const [ruta, operaciones] of Object.entries(openapi.paths)) {
      for (const metodo of Object.keys(operaciones)) {
        if (metodo === 'parameters') continue;
        documentadas.add(`${metodo.toUpperCase()} ${ruta}`);
      }
    }

    const sinDocumentar = rutasRegistradas().filter((ruta) => {
      // La propia documentación no se documenta a sí misma.
      if (ruta.includes('/docs')) return false;
      return !documentadas.has(ruta);
    });

    expect(sinDocumentar).toEqual([]);
  });

  it('no documenta rutas que la API no expone', () => {
    const registradas = new Set(rutasRegistradas());

    const inexistentes = [];
    for (const [ruta, operaciones] of Object.entries(openapi.paths)) {
      for (const metodo of Object.keys(operaciones)) {
        if (metodo === 'parameters') continue;
        const entrada = `${metodo.toUpperCase()} ${ruta}`;
        if (!registradas.has(entrada)) inexistentes.push(entrada);
      }
    }

    expect(inexistentes).toEqual([]);
  });

  it('cada operación declara resumen y respuestas', () => {
    const incompletas = [];
    for (const [ruta, operaciones] of Object.entries(openapi.paths)) {
      for (const [metodo, operacion] of Object.entries(operaciones)) {
        if (metodo === 'parameters') continue;
        if (!operacion.summary || !operacion.responses) incompletas.push(`${metodo} ${ruta}`);
      }
    }

    expect(incompletas).toEqual([]);
  });

  it('se sirve fuera de producción', async () => {
    const spec = await request(app).get('/api/docs/openapi.json');

    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.1.0');
    expect(spec.body.paths['/reservas']).toBeDefined();
  });

  it('no se expone cuando NODE_ENV es production', async () => {
    jest.resetModules();
    const envOriginal = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const { default: appProduccion } = await import('../src/app.js');
      // Al reimportar la app se crea una conexión nueva: hay que cerrarla o el
      // proceso de pruebas queda esperándola.
      const { default: conexionProduccion } = await import('../src/config/database.js');

      try {
        const res = await request(appProduccion).get('/api/docs/openapi.json');
        expect(res.status).toBe(404);
      } finally {
        await conexionProduccion.close();
      }
    } finally {
      process.env.NODE_ENV = envOriginal;
      jest.resetModules();
    }
  });
});
