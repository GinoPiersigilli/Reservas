import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const IMG_DIR = path.join(ROOT, 'docs', 'img');

function findBrowserPath() {
  if (process.env.BROWSER_PATH && fs.existsSync(process.env.BROWSER_PATH)) {
    return process.env.BROWSER_PATH;
  }
  if (process.env.BROWSER_PATH) {
    throw new Error(
      `El navegador especificado en BROWSER_PATH no existe: ${process.env.BROWSER_PATH}`
    );
  }

  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  const candidates = isWindows
    ? [
        path.join(
          process.env.PROGRAMFILES || 'C:\\Program Files',
          'Google\\Chrome\\Application\\chrome.exe'
        ),
        path.join(
          process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
          'Google\\Chrome\\Application\\chrome.exe'
        ),
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(
          process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
          'Microsoft\\Edge\\Application\\msedge.exe'
        ),
        path.join(
          process.env.PROGRAMFILES || 'C:\\Program Files',
          'Microsoft\\Edge\\Application\\msedge.exe'
        ),
        path.join(
          process.env.PROGRAMFILES || 'C:\\Program Files',
          'BraveSoftware\\Brave-Browser\\Application\\brave.exe'
        ),
        path.join(
          process.env.LOCALAPPDATA || '',
          'BraveSoftware\\Brave-Browser\\Application\\brave.exe'
        )
      ]
    : isMac
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/brave-browser',
          '/usr/bin/microsoft-edge'
        ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'No se encontró ningún navegador compatible (Chrome, Edge o Brave) en las rutas estándar. ' +
      'Por favor configurá la variable de entorno BROWSER_PATH con la ruta al ejecutable de tu navegador.'
  );
}

const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'reservas-capturas-'));

fs.mkdirSync(IMG_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHttp(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // retry
    }
    await sleep(300);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
}

function startMockBackend() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url.split('?')[0];
    res.setHeader('Content-Type', 'application/json');

    if (url === '/api/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', db: 'ok' }));
    } else if (url === '/api/auth/login') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          token: 'mock-jwt-token',
          usuario: {
            id: 1,
            nombre: 'Administrador Bedelía',
            email: 'admin@utnfrc.edu.ar',
            rol: 'admin'
          }
        })
      );
    } else if (url === '/api/aulas') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          datos: [
            {
              id: 1,
              nombre: 'Laboratorio de Informática 1',
              capacidad: 30,
              ubicacion: 'Edificio Central'
            },
            { id: 2, nombre: 'Aula Magna', capacidad: 120, ubicacion: 'Edificio Central' }
          ]
        })
      );
    } else if (url.includes('/disponibilidad')) {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          datos: [
            { horaInicio: '10:00', horaFin: '12:00', estado: 'aprobada' },
            { horaInicio: '14:00', horaFin: '16:00', estado: 'pendiente' }
          ]
        })
      );
    } else if (url === '/api/reservas/resumen') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          totales: { total: 10, aprobadas: 6, pendientes: 3, rechazadas: 1 },
          proximasHoy: [
            {
              id: 1,
              motivo: 'Clase Sistemas',
              aula: { nombre: 'Laboratorio de Informática 1' },
              horaInicio: '10:00',
              horaFin: '12:00',
              estado: 'aprobada',
              usuario: { id: 2, nombre: 'David López', email: 'david@utnfrc.edu.ar' }
            }
          ],
          topAulas: [{ aula: 'Laboratorio de Informática 1', cantidad: 5 }]
        })
      );
    } else if (url.startsWith('/api/reservas/') && !url.includes('historial')) {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          datos: {
            id: 1,
            motivo: 'Clase Práctica',
            fecha: '2026-11-09',
            horaInicio: '10:00',
            horaFin: '12:00',
            estado: 'pendiente',
            aula: { id: 1, nombre: 'Laboratorio de Informática 1', capacidad: 30 },
            usuario: { id: 2, nombre: 'David López', email: 'david@utnfrc.edu.ar' },
            historial: []
          }
        })
      );
    } else if (url === '/api/reservas') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          datos: [
            {
              id: 1,
              motivo: 'Clase Práctica',
              fecha: '2026-11-09',
              horaInicio: '10:00',
              horaFin: '12:00',
              estado: 'pendiente',
              aula: { id: 1, nombre: 'Laboratorio de Informática 1' },
              usuario: { id: 2, nombre: 'David López', email: 'david@utnfrc.edu.ar' }
            }
          ],
          paginacion: { total: 1, pagina: 1, limite: 10, totalPaginas: 1 }
        })
      );
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({ datos: [] }));
    }
  });

  return new Promise((resolve) => {
    server.listen(3001, () => resolve(server));
  });
}

async function main() {
  const procs = [];
  const cleanup = () => {
    for (const p of procs) {
      try {
        p.kill();
      } catch {
        // ignore
      }
    }
    try {
      if (fs.existsSync(USER_DATA_DIR)) {
        fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  };
  process.on('exit', cleanup);

  console.log('1. Verificando o iniciando backend en puerto 3001...');
  try {
    await waitForHttp('http://localhost:3001/api/health', 1500);
    console.log('   Backend ya activo.');
  } catch {
    const backendProc = spawn('node', ['index.js'], {
      cwd: path.join(ROOT, 'backend'),
      stdio: 'ignore'
    });
    procs.push(backendProc);
    try {
      await waitForHttp('http://localhost:3001/api/health', 4000);
      console.log('   Backend iniciado con PostgreSQL.');
    } catch {
      console.log('   PostgreSQL no está activo; levantando servidor mock para capturas...');
      const mockServer = await startMockBackend();
      procs.push({ kill: () => mockServer.close() });
    }
  }

  console.log('2. Verificando o iniciando frontend en puerto 5173...');
  try {
    await waitForHttp('http://localhost:5173/', 1500);
    console.log('   Frontend ya activo.');
  } catch {
    const frontendProc = spawn(
      process.execPath,
      [
        path.join(ROOT, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'),
        '--port',
        '5173',
        '--strictPort'
      ],
      {
        cwd: path.join(ROOT, 'frontend'),
        stdio: 'ignore'
      }
    );
    procs.push(frontendProc);
    await waitForHttp('http://localhost:5173/');
  }

  console.log('3. Obteniendo sesiones de prueba (admin y usuario)...');
  const loginAdminRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@utnfrc.edu.ar', password: 'admin123' })
  });
  const adminAuth = await loginAdminRes.json();

  const loginUserRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'david@utnfrc.edu.ar', password: 'user123' })
  });
  const userAuth = await loginUserRes.json();

  // Obtener el ID de una reserva existente para la captura de detalle
  const reservasAdminRes = await fetch('http://localhost:3001/api/reservas?limit=10', {
    headers: { Authorization: `Bearer ${adminAuth.token}` }
  });
  const reservasAdminData = await reservasAdminRes.json();
  const listaReservas = reservasAdminData.datos || reservasAdminData.data || [];
  const reservaPendiente = listaReservas.find((r) => r.estado === 'pendiente') || listaReservas[0];
  const idDetalle = reservaPendiente?.id || 1;

  const browserPath = findBrowserPath();
  console.log(
    `4. Iniciando navegador headless (${path.basename(browserPath)}) con CDP en puerto 9229 y locale es-AR...`
  );
  const browserProc = spawn(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${USER_DATA_DIR}`,
      '--remote-debugging-port=9229',
      '--lang=es-AR',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );
  procs.push(browserProc);

  let targets = [];
  const startTargets = Date.now();
  while (Date.now() - startTargets < 15000) {
    try {
      const res = await fetch('http://127.0.0.1:9229/json/list');
      if (res.ok) {
        targets = await res.json();
        if (targets.length > 0 && targets.some((t) => t.webSocketDebuggerUrl)) {
          break;
        }
      }
    } catch {}
    await sleep(200);
  }
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    throw new Error(
      'No se pudo obtener un target de página con webSocketDebuggerUrl del navegador'
    );
  }
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Configurar emulación de locale es-AR y zona horaria America/Argentina/Cordoba
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Argentina/Cordoba' });
  try {
    await cdp.send('Emulation.setLocaleOverride', { locale: 'es-AR' });
  } catch {
    // Si la versión no soporta setLocaleOverride, el flag --lang=es-AR ya lo define
  }
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptLanguage: 'es-AR,es'
  });

  async function setViewport(width, height, mobile = false) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile
    });
  }

  async function setSession(authObj) {
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await sleep(600);
    if (!authObj) {
      await cdp.send('Runtime.evaluate', {
        expression: `localStorage.removeItem('token'); localStorage.removeItem('usuario');`
      });
    } else {
      const tokenStr = JSON.stringify(authObj.token);
      const userStr = JSON.stringify(JSON.stringify(authObj.usuario));
      await cdp.send('Runtime.evaluate', {
        expression: `localStorage.setItem('token', ${tokenStr}); localStorage.setItem('usuario', ${userStr});`
      });
    }
  }

  async function goAndVerify(ruta, widthsToVerify = [360, 768, 1280]) {
    await cdp.send('Page.navigate', { url: `http://localhost:5173${ruta}` });
    await sleep(1400);
    await cdp.send('Runtime.evaluate', {
      expression: 'document.fonts ? document.fonts.ready : Promise.resolve()',
      awaitPromise: true
    });

    for (const w of widthsToVerify) {
      await setViewport(w, 850, w < 768);
      await sleep(250);
      const evalRes = await cdp.send('Runtime.evaluate', {
        expression: `(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          innerWidth: window.innerWidth
        }))()`,
        returnByValue: true
      });
      const { scrollWidth, innerWidth } = evalRes.result.value;
      console.log(
        `   [Responsive ${w}px] ${ruta}: scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`
      );
      if (scrollWidth > innerWidth) {
        throw new Error(
          `Desborde horizontal en ${ruta} a ${w}px: scrollWidth=${scrollWidth} > innerWidth=${innerWidth}`
        );
      }
    }
  }

  async function capture(nombreArchivo, width, height, mobile = false, customEval = null) {
    await setViewport(width, height, mobile);
    await sleep(400);
    if (customEval) {
      await cdp.send('Runtime.evaluate', {
        expression: customEval,
        awaitPromise: true
      });
      await sleep(350);
    }
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false
    });
    const destino = path.join(IMG_DIR, nombreArchivo);
    fs.writeFileSync(destino, Buffer.from(data, 'base64'));
    console.log(`   [Captura guardada] docs/img/${nombreArchivo} (${width}x${height})`);
  }

  async function setTemaModo(tema) {
    const modo = tema === 'oscuro' ? 'dark' : 'light';
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        try {
          localStorage.setItem('tema', '${tema}');
        } catch {}
        document.documentElement.setAttribute('data-theme', '${modo}');
        document.documentElement.setAttribute('data-tema', '${tema}');
      })()`
    });
    await sleep(300);
  }

  // A) Login (sin sesión)
  await setSession(null);
  await goAndVerify('/login');
  await capture('login-escritorio.png', 1280, 800, false);
  await setTemaModo('oscuro');
  await capture('login-oscuro.png', 1280, 800, false);
  await setTemaModo('claro');
  await capture('login-movil.png', 360, 800, true);

  // B) Sesión Administrador: Reservas, Nueva reserva (grilla), Detalle, Panel
  await setSession(adminAuth);

  await goAndVerify('/reservas');
  await capture('reservas-admin-escritorio.png', 1280, 800, false);

  const reservaAprobadaManiana =
    listaReservas.find(
      (r) => r.estado === 'aprobada' && r.horaInicio >= '10:00' && r.horaInicio <= '12:00'
    ) || listaReservas[1];
  const fechaConOcupadas = reservaAprobadaManiana?.fecha || '2026-11-12';

  // Crear una reserva pendiente en Aula 910 (09:00 a 10:30) en la misma fecha para que la captura muestre simultáneamente bloque Aprobada (macizo), Pendiente (rayado) y Seleccionado
  await fetch('http://localhost:3001/api/reservas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userAuth.token}`
    },
    body: JSON.stringify({
      aulaId: 1,
      fecha: fechaConOcupadas,
      horaInicio: '09:00',
      horaFin: '10:30',
      cantidadPersonas: 25,
      motivo: 'Parcial de Desarrollo de Software'
    })
  });

  await goAndVerify('/reservas/nueva', [360, 800, 1024, 1280]);
  // Seleccionar la fecha con reservas ocupadas y luego elegir una franja libre en Aula 910
  const seleccionarFechaYFranja = `(async () => {
    const inputFecha = document.querySelector('input[type="date"]');
    if (inputFecha) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inputFecha, '${fechaConOcupadas}');
      inputFecha.dispatchEvent(new Event('input', { bubbles: true }));
      inputFecha.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 700));
    }
    const b1 = document.querySelector('button[aria-label*="Aula 910, 11:00 a 11:30, libre"]');
    const b2 = document.querySelector('button[aria-label*="Aula 910, 11:30 a 12:00, libre"]');
    if (b1 && b2) {
      b1.click();
      b2.click();
    }
  })()`;
  await capture('nueva-reserva-grilla-escritorio.png', 1280, 960, false, seleccionarFechaYFranja);
  await setTemaModo('oscuro');
  await capture('nueva-reserva-grilla-oscuro.png', 1280, 960, false);
  await setTemaModo('claro');
  await capture('nueva-reserva-grilla-1280.png', 1280, 960, false);
  await capture('nueva-reserva-grilla-1024.png', 1024, 850, false);
  await capture('nueva-reserva-grilla-800.png', 800, 850, false);
  await capture('nueva-reserva-grilla-360.png', 360, 900, true);
  await capture('nueva-reserva-grilla-movil.png', 360, 900, true);

  await goAndVerify(`/reservas/${idDetalle}`);
  await capture('detalle-reserva-escritorio.png', 1280, 860, false);
  await capture('detalle-reserva-movil.png', 360, 860, true);

  await goAndVerify('/resumen');
  await capture('panel-admin-escritorio.png', 1280, 860, false);
  await setTemaModo('oscuro');
  await capture('panel-admin-oscuro.png', 1280, 860, false);
  await setTemaModo('claro');
  await capture('panel-admin-movil.png', 360, 860, true);

  // C) Sesión Usuario común (david@utnfrc.edu.ar): Mis reservas en móvil y escritorio
  await setSession(userAuth);
  await goAndVerify('/reservas');
  await capture('reservas-usuario-escritorio.png', 1280, 800, false);
  await capture('reservas-usuario-movil.png', 360, 800, true);

  cdp.close();
  cleanup();
  await sleep(500);
  try {
    if (fs.existsSync(USER_DATA_DIR)) {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
  console.log('5. Verificación responsive (360, 768, 1280 px) y capturas completadas con éxito.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en script de capturas:', err);
  process.exit(1);
});
