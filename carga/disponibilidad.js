/**
 * Prueba de carga de los caminos más usados de la API de reservas.
 *
 * Uso: k6 run carga/disponibilidad.js
 * Ver carga/README.md para requisitos, parámetros y umbrales.
 */
import http from 'k6/http';
import { check, group } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api';
const VUS = Number(__ENV.VUS || 10);
const DURACION = __ENV.DURACION || '30s';
const EMAIL = __ENV.EMAIL || 'david@utnfrc.edu.ar';
const PASSWORD = __ENV.PASSWORD || 'user123';

const reservasCreadas = new Counter('reservas_creadas');
const franjasOcupadas = new Counter('franjas_ya_ocupadas');

export const options = {
  scenarios: {
    navegacion: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURACION
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{tipo:lectura}': ['p(95)<400'],
    'http_req_duration{tipo:escritura}': ['p(95)<800'],
    checks: ['rate>0.99']
  }
};

/** Inicia sesión una sola vez y comparte el token entre los usuarios virtuales. */
export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status !== 200) {
    throw new Error(
      `No se pudo iniciar sesión (${res.status}). ¿Están aplicadas las semillas de demostración?`
    );
  }

  return { token: res.json('token') };
}

/** Fecha lejana para no competir con los datos de demostración. */
function fechaDePrueba() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 60 + (__VU % 30));
  return fecha.toISOString().slice(0, 10);
}

export default function (datos) {
  const auth = {
    headers: {
      Authorization: `Bearer ${datos.token}`,
      'Content-Type': 'application/json'
    }
  };

  group('lectura: listado y disponibilidad', () => {
    const listado = http.get(`${BASE_URL}/reservas?limit=10`, {
      ...auth,
      tags: { tipo: 'lectura' }
    });
    check(listado, {
      'listado responde 200': (r) => r.status === 200,
      'listado trae datos': (r) => Array.isArray(r.json('datos'))
    });

    const aulaId = 1 + (__ITER % 3);
    const disponibilidad = http.get(
      `${BASE_URL}/aulas/${aulaId}/disponibilidad?fecha=${fechaDePrueba()}`,
      { ...auth, tags: { tipo: 'lectura' } }
    );
    check(disponibilidad, { 'disponibilidad responde 200': (r) => r.status === 200 });
  });

  group('escritura: alta de reserva', () => {
    const hora = 8 + (__ITER % 13);
    const cuerpo = JSON.stringify({
      aulaId: 1 + (__ITER % 3),
      fecha: fechaDePrueba(),
      horaInicio: `${String(hora).padStart(2, '0')}:00`,
      horaFin: `${String(hora + 1).padStart(2, '0')}:00`,
      cantidadPersonas: 10,
      motivo: `Prueba de carga k6 (VU ${__VU}, iteración ${__ITER})`
    });

    const alta = http.post(`${BASE_URL}/reservas`, cuerpo, {
      ...auth,
      tags: { tipo: 'escritura' }
    });

    // 400 por franja ocupada es la respuesta correcta ante dos pedidos a la
    // misma franja: se cuenta aparte y no se considera un fallo.
    const esConflicto = alta.status === 400 && /ya está reservada/i.test(alta.body || '');
    if (alta.status === 201) reservasCreadas.add(1);
    if (esConflicto) franjasOcupadas.add(1);

    check(alta, {
      'alta responde 201 o conflicto esperado': (r) => r.status === 201 || esConflicto
    });
  });
}
