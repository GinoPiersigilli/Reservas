import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'c:\\Users\\ginob\\OneDrive\\Desktop\\Proyectos\\reservas';
const IMG_DIR = path.join(ROOT, 'docs', 'img');
const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const USER_DATA_DIR = 'C:\\Users\\ginob\\.gemini\\antigravity\\brain\\b9ae23d1-77cd-4b9a-938d-095f51419b55\\scratch\\brave-profile';

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(USER_DATA_DIR, { recursive: true });

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
  };
  process.on('exit', cleanup);

  console.log('1. Iniciando backend en puerto 3001...');
  const backendProc = spawn('node', ['index.js'], {
    cwd: path.join(ROOT, 'backend'),
    stdio: 'ignore'
  });
  procs.push(backendProc);
  await waitForHttp('http://localhost:3001/api/health');

  console.log('2. Iniciando frontend preview en puerto 5173...');
  const frontendProc = spawn(
    process.execPath,
    [path.join(ROOT, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5173', '--strictPort'],
    {
      cwd: path.join(ROOT, 'frontend'),
      stdio: 'ignore'
    }
  );
  procs.push(frontendProc);
  await waitForHttp('http://localhost:5173/');

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

  console.log('4. Iniciando navegador headless Brave con CDP en puerto 9229 y locale es-AR...');
  const braveProc = spawn(
    BRAVE_PATH,
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
  procs.push(braveProc);

  const versionRes = await waitForHttp('http://127.0.0.1:9229/json/list');
  const targets = await versionRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
      console.log(`   [Responsive ${w}px] ${ruta}: scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`);
      if (scrollWidth > innerWidth) {
        throw new Error(`Desborde horizontal en ${ruta} a ${w}px: scrollWidth=${scrollWidth} > innerWidth=${innerWidth}`);
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

  // A) Login (sin sesión)
  await setSession(null);
  await goAndVerify('/login');
  // Ocultar widget externo de Clerk si demora o muestra aviso de clave de desarrollo para mantener la captura limpia y sin claves
  const ocultarClerk = `(() => {
    document.querySelectorAll('[class*="separador"], [class*="bloqueClerk"]').forEach(el => { el.style.display = 'none'; });
  })()`;
  await capture('login-escritorio.png', 1280, 800, false, ocultarClerk);
  await capture('login-movil.png', 360, 800, true, ocultarClerk);

  // B) Sesión Administrador: Reservas, Nueva reserva (grilla), Detalle, Panel
  await setSession(adminAuth);

  await goAndVerify('/reservas');
  await capture('reservas-admin-escritorio.png', 1280, 800, false);

  const reservaAprobadaManiana = listaReservas.find((r) => r.estado === 'aprobada' && r.horaInicio >= '10:00' && r.horaInicio <= '12:00') || listaReservas[1];
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
  await capture('panel-admin-movil.png', 360, 860, true);

  // C) Sesión Usuario común (david@utnfrc.edu.ar): Mis reservas en móvil y escritorio
  await setSession(userAuth);
  await goAndVerify('/reservas');
  await capture('reservas-usuario-escritorio.png', 1280, 800, false);
  await capture('reservas-usuario-movil.png', 360, 800, true);

  cdp.close();
  cleanup();
  console.log('5. Verificación responsive (360, 768, 1280 px) y capturas completadas con éxito.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en script de capturas:', err);
  process.exit(1);
});

