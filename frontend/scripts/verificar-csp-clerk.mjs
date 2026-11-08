import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const DIST_DIR = path.join(ROOT, 'frontend', 'dist');

function findBrowserPath() {
  if (process.env.BROWSER_PATH && fs.existsSync(process.env.BROWSER_PATH)) {
    return process.env.BROWSER_PATH;
  }
  if (process.env.BROWSER_PATH) {
    throw new Error(`El navegador especificado en BROWSER_PATH no existe: ${process.env.BROWSER_PATH}`);
  }

  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  const candidates = isWindows ? [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
  ] : isMac ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ] : [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/brave-browser',
    '/usr/bin/microsoft-edge',
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

const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'reservas-csp-'));

const PORT = 5175;
const CDP_PORT = 9231;

// Política de prueba SIN 'unsafe-inline' en style-src
const TEST_CSP = [
  "default-src 'self'",
  "script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com https://*.protect.clerk.com:*",
  "style-src 'self'", // <-- ESTRICTO: SIN 'unsafe-inline'
  "img-src 'self' data: https://img.clerk.com",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.protect.clerk.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join('; ');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error(`Timeout esperando ${url}`);
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.eventListeners = new Map();
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
      } else if (msg.method) {
        const listeners = this.eventListeners.get(msg.method) || [];
        listeners.forEach((fn) => fn(msg.params));
      }
    });
  }

  on(event, fn) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(fn);
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

function startStaticServer() {
  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    let filePath = path.join(DIST_DIR, reqUrl);

    // SPA fallback: si no tiene extensión o no existe, servir index.html
    if (!path.extname(filePath) || !fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error interno al leer archivo');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Security-Policy': TEST_CSP,
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function main() {
  console.log('=== VERIFICACIÓN EXPERIMENTAL DE CSP (Clerk OAuth y style-src) ===\n');
  console.log(`CSP evaluada:\n${TEST_CSP}\n`);

  const procs = [];
  let server;

  const cleanup = () => {
    if (server) {
      try { server.close(); } catch {}
    }
    for (const p of procs) {
      try { p.kill(); } catch {}
    }
    try {
      if (fs.existsSync(USER_DATA_DIR)) {
        fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
      }
    } catch {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });

  console.log(`1. Iniciando servidor estático con CSP de prueba en http://127.0.0.1:${PORT}...`);
  server = await startStaticServer();

  const browserPath = findBrowserPath();
  console.log(`2. Lanzando navegador headless (${path.basename(browserPath)}) con CDP en puerto ${CDP_PORT}...`);
  const browserProc = spawn(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${USER_DATA_DIR}`,
      `--remote-debugging-port=${CDP_PORT}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  );
  procs.push(browserProc);

  let targets = [];
  const startTargets = Date.now();
  while (Date.now() - startTargets < 15000) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
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
    throw new Error('No se pudo obtener un target de página con webSocketDebuggerUrl del navegador');
  }

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');

  const logEntries = [];
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (entry.level === 'error' || entry.text.includes('Content Security Policy') || entry.text.includes('Refused')) {
      logEntries.push({
        source: entry.source,
        level: entry.level,
        text: entry.text,
        url: entry.url
      });
    }
  });

  const consoleLogs = [];
  cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
    const text = args.map((a) => a.value || a.description || '').join(' ');
    if (type === 'error' || text.includes('Content Security Policy') || text.includes('Refused')) {
      consoleLogs.push({ type, text });
    }
  });

  // Listener para capturar SecurityPolicyViolationEvent en la página
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__cspViolations = [];
      window.addEventListener('securitypolicyviolation', (e) => {
        window.__cspViolations.push({
          effectiveDirective: e.effectiveDirective,
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective,
          originalPolicy: e.originalPolicy,
          sample: e.sample,
          sourceFile: e.sourceFile,
          lineNumber: e.lineNumber
        });
      });
    `
  });

  // --- PRUEBA 1: /login ---
  console.log('\n3. Evaluando ruta /login...');
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/login` });
  await sleep(4000); // Dar tiempo a que Clerk FAPI se descargue, ejecute e inicialice

  const loginViolationsRes = await cdp.send('Runtime.evaluate', {
    expression: 'JSON.stringify(window.__cspViolations || [])',
    returnByValue: true
  });
  const loginViolations = JSON.parse(loginViolationsRes.result.value || '[]');

  console.log(`   - Violaciones securitypolicyviolation capturadas en /login: ${loginViolations.length}`);
  for (const v of loginViolations) {
    console.log(`     * Directiva: ${v.effectiveDirective} | Bloqueado: ${v.blockedURI} | Muestra: "${v.sample}"`);
  }

  // --- PRUEBA 2: /sso-callback ---
  console.log('\n4. Evaluando ruta /sso-callback...');
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/sso-callback` });
  await sleep(4000); // Dar tiempo a que AuthenticateWithRedirectCallback monte e intente procesar

  const callbackViolationsRes = await cdp.send('Runtime.evaluate', {
    expression: 'JSON.stringify(window.__cspViolations || [])',
    returnByValue: true
  });
  const callbackViolations = JSON.parse(callbackViolationsRes.result.value || '[]');

  console.log(`   - Violaciones securitypolicyviolation capturadas en /sso-callback: ${callbackViolations.length}`);
  for (const v of callbackViolations) {
    console.log(`     * Directiva: ${v.effectiveDirective} | Bloqueado: ${v.blockedURI} | Muestra: "${v.sample}"`);
  }

  // Filtrar logs de consola y navegador relacionados a CSP
  const cspConsoleErrors = [
    ...logEntries.filter((l) => l.text.includes('Content Security Policy') || l.text.includes('style-src')),
    ...consoleLogs.filter((c) => c.text.includes('Content Security Policy') || c.text.includes('style-src'))
  ];

  console.log('\n5. Errores de consola / logs del navegador relacionados a CSP:');
  if (cspConsoleErrors.length === 0) {
    console.log('   (Ninguno)');
  } else {
    for (const err of cspConsoleErrors) {
      console.log(`   - [${err.source || err.type}] ${err.text}`);
    }
  }

  console.log('\n================ RESULTADOS FINALES ================');
  const totalViolaciones = loginViolations.length + callbackViolations.length;
  const violacionesStyleSrc = [...loginViolations, ...callbackViolations].filter(
    (v) => v.effectiveDirective === 'style-src' || v.effectiveDirective === 'style-src-elem' || v.effectiveDirective === 'style-src-attr'
  );

  console.log(`Total violaciones de CSP registradas: ${totalViolaciones}`);
  console.log(`Violaciones de directiva style-src: ${violacionesStyleSrc.length}`);

  if (violacionesStyleSrc.length === 0) {
    console.log('\nDIAGNÓSTICO EMPÍRICO:');
    console.log('Al haber reemplazado <SignIn> y <SignUp> embebidos por botones nativos ("Continuar con Google"),');
    console.log('Clerk NO inyectó estilos en línea en /login ni en /sso-callback durante la inicialización.');
    console.log('Sin embargo, según la especificación del requerimiento, frontend/nginx.conf no debe modificarse.');
  } else {
    console.log('\nDIAGNÓSTICO EMPÍRICO:');
    console.log(`Se detectaron ${violacionesStyleSrc.length} violaciones de style-src. Clerk aún inyecta estilos inline.`);
    console.log('Por lo tanto, "style-src unsafe-inline" NO se puede remover sin romper los componentes.');
  }

  cdp.close();
  cleanup();
  await sleep(500);
  try {
    if (fs.existsSync(USER_DATA_DIR)) {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    }
  } catch {}
  process.exit(0);
}

main().catch((err) => {
  console.error('Error durante la verificación:', err);
  process.exit(1);
});

