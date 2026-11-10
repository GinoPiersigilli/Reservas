import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rutaTokens = path.resolve(__dirname, '../src/styles/tokens.css');

export function extraerTokensHex(contenidoCss) {
  const mapa = {};
  const regex = /(--[a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g;
  let match = regex.exec(contenidoCss);
  while (match) {
    mapa[match[1]] = match[2].toUpperCase();
    match = regex.exec(contenidoCss);
  }
  return mapa;
}

export function extraerBloquesTokens(contenidoCss) {
  const indexDark = contenidoCss.indexOf('data-theme');
  if (indexDark === -1) {
    return {
      claro: extraerTokensHex(contenidoCss),
      oscuro: {}
    };
  }
  const bloqueClaro = contenidoCss.slice(0, indexDark);
  const bloqueOscuro = contenidoCss.slice(indexDark);

  return {
    claro: extraerTokensHex(bloqueClaro),
    oscuro: extraerTokensHex(bloqueOscuro)
  };
}

function hexARgb(hex) {
  const limpio = hex.replace('#', '');
  return [
    parseInt(limpio.slice(0, 2), 16),
    parseInt(limpio.slice(2, 4), 16),
    parseInt(limpio.slice(4, 6), 16)
  ];
}

function luminanciaRelativa(hex) {
  const [r, g, b] = hexARgb(hex).map((canal) => {
    const s = canal / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function calcularContraste(hexA, hexB) {
  const lum1 = luminanciaRelativa(hexA);
  const lum2 = luminanciaRelativa(hexB);
  const masClaro = Math.max(lum1, lum2);
  const masOscuro = Math.min(lum1, lum2);
  return (masClaro + 0.05) / (masOscuro + 0.05);
}

export const PARES_PROPUESTA = [
  {
    nombre: 'Texto principal sobre fondo (--tinta / --fondo)',
    fg: '--tinta',
    bg: '--fondo',
    minimoAA: 4.5,
    referenciaPropuesta: 14.5
  },
  {
    nombre: 'Texto principal sobre superficie (--tinta / --superficie)',
    fg: '--tinta',
    bg: '--superficie',
    minimoAA: 4.5,
    referenciaPropuesta: 15.7
  },
  {
    nombre: 'Texto secundario sobre blanco (--tinta-2 / --superficie)',
    fg: '--tinta-2',
    bg: '--superficie',
    minimoAA: 4.5,
    referenciaPropuesta: 6.2
  },
  {
    nombre: 'Texto blanco sobre acento (--tinta-inversa / --acento)',
    fg: '--tinta-inversa',
    bg: '--acento',
    minimoAA: 4.5,
    referenciaPropuesta: 8.3
  },
  {
    nombre: 'Contorno de control sobre superficie (--borde-control / --superficie)',
    fg: '--borde-control',
    bg: '--superficie',
    minimoAA: 3.0,
    referenciaPropuesta: 3.1
  },
  {
    nombre: 'Texto blanco sobre peligro (--tinta-inversa / --peligro)',
    fg: '--tinta-inversa',
    bg: '--peligro',
    minimoAA: 4.5,
    referenciaPropuesta: 7.3
  },
  {
    nombre: 'Estado Pendiente (--estado-pendiente-texto / --estado-pendiente-fondo)',
    fg: '--estado-pendiente-texto',
    bg: '--estado-pendiente-fondo',
    minimoAA: 4.5,
    referenciaPropuesta: 7.1
  },
  {
    nombre: 'Estado Aprobada (--estado-aprobada-texto / --estado-aprobada-fondo)',
    fg: '--estado-aprobada-texto',
    bg: '--estado-aprobada-fondo',
    minimoAA: 4.5,
    referenciaPropuesta: 6.7
  },
  {
    nombre: 'Estado Rechazada (--estado-rechazada-texto / --estado-rechazada-fondo)',
    fg: '--estado-rechazada-texto',
    bg: '--estado-rechazada-fondo',
    minimoAA: 4.5,
    referenciaPropuesta: 7.2
  },
  {
    nombre: 'Estado Cancelada (--estado-cancelada-texto / --estado-cancelada-fondo)',
    fg: '--estado-cancelada-texto',
    bg: '--estado-cancelada-fondo',
    minimoAA: 4.5,
    referenciaPropuesta: 6.8
  }
];

export const PARES_OSCURO = [
  {
    nombre: 'Modo oscuro: Texto principal sobre fondo (--tinta / --fondo)',
    fg: '--tinta',
    bg: '--fondo',
    minimoAA: 4.5,
    referenciaEsperada: 15.6
  },
  {
    nombre: 'Modo oscuro: Texto principal sobre superficie (--tinta / --superficie)',
    fg: '--tinta',
    bg: '--superficie',
    minimoAA: 4.5,
    referenciaEsperada: 14.1
  },
  {
    nombre: 'Modo oscuro: Texto secundario sobre superficie (--tinta-2 / --superficie)',
    fg: '--tinta-2',
    bg: '--superficie',
    minimoAA: 4.5,
    referenciaEsperada: 7.6
  },
  {
    nombre: 'Modo oscuro: Texto inverso sobre acento (--tinta-inversa / --acento)',
    fg: '--tinta-inversa',
    bg: '--acento',
    minimoAA: 4.5,
    referenciaEsperada: 7.9
  },
  {
    nombre: 'Modo oscuro: Contorno de control sobre superficie (--borde-control / --superficie)',
    fg: '--borde-control',
    bg: '--superficie',
    minimoAA: 3.0,
    referenciaEsperada: 3.8
  },
  {
    nombre: 'Modo oscuro: Texto blanco sobre peligro (#FFFFFF / --peligro)',
    colorFgFijo: '#FFFFFF',
    bg: '--peligro',
    minimoAA: 4.5,
    referenciaEsperada: 5.4
  },
  {
    nombre: 'Modo oscuro: Peligro texto sobre fondo (--peligro-texto / --peligro-fondo)',
    fg: '--peligro-texto',
    bg: '--peligro-fondo',
    minimoAA: 4.5,
    referenciaEsperada: 7.6
  },
  {
    nombre: 'Modo oscuro: Estado Pendiente (--estado-pendiente-texto / --estado-pendiente-fondo)',
    fg: '--estado-pendiente-texto',
    bg: '--estado-pendiente-fondo',
    minimoAA: 4.5,
    referenciaEsperada: 8.2
  },
  {
    nombre: 'Modo oscuro: Estado Aprobada (--estado-aprobada-texto / --estado-aprobada-fondo)',
    fg: '--estado-aprobada-texto',
    bg: '--estado-aprobada-fondo',
    minimoAA: 4.5,
    referenciaEsperada: 8.0
  },
  {
    nombre: 'Modo oscuro: Estado Rechazada (--estado-rechazada-texto / --estado-rechazada-fondo)',
    fg: '--estado-rechazada-texto',
    bg: '--estado-rechazada-fondo',
    minimoAA: 4.5,
    referenciaEsperada: 7.6
  },
  {
    nombre: 'Modo oscuro: Estado Cancelada (--estado-cancelada-texto / --estado-cancelada-fondo)',
    fg: '--estado-cancelada-texto',
    bg: '--estado-cancelada-fondo',
    minimoAA: 4.5,
    referenciaEsperada: 7.5
  }
];

export function verificarParesTokens(tema = 'claro') {
  const css = fs.readFileSync(rutaTokens, 'utf8');
  const bloques = extraerBloquesTokens(css);
  const esOscuro = tema === 'oscuro' || tema === 'dark';
  const tokens = esOscuro ? bloques.oscuro : bloques.claro;
  const pares = esOscuro ? PARES_OSCURO : PARES_PROPUESTA;

  return pares.map((par) => {
    const colorFg = par.colorFgFijo || tokens[par.fg];
    const colorBg = par.colorBgFijo || tokens[par.bg];
    const ratio = calcularContraste(colorFg, colorBg);
    const ratioRedondeado = Number(ratio.toFixed(1));
    const cumpleAA = ratio >= par.minimoAA;
    const ref = par.referenciaPropuesta ?? par.referenciaEsperada;
    const coincidePropuesta = ref !== undefined ? Math.abs(ratioRedondeado - ref) <= 0.2 : true;

    return {
      ...par,
      colorFg,
      colorBg,
      ratio: ratioRedondeado,
      cumpleAA,
      coincidePropuesta
    };
  });
}

export function verificarTodosLosTemas() {
  const claro = verificarParesTokens('claro');
  const oscuro = verificarParesTokens('oscuro');
  return { claro, oscuro };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const { claro, oscuro } = verificarTodosLosTemas();
  let fallos = 0;

  console.log('Verificación de contraste WCAG 2.1 sobre src/styles/tokens.css:\n');

  console.log('--- Modo Claro (:root) ---');
  for (const r of claro) {
    const estado = r.cumpleAA && r.coincidePropuesta ? 'OK' : 'FALLO';
    if (estado !== 'OK') fallos += 1;
    console.log(
      `[${estado}] ${r.nombre}: ${r.colorFg} sobre ${r.colorBg} -> ${r.ratio}:1 (propuesta: ${r.referenciaPropuesta}:1, mín AA: ${r.minimoAA}:1)`
    );
  }

  console.log('\n--- Modo Oscuro (:root[data-theme="dark"]) ---');
  for (const r of oscuro) {
    const estado = r.cumpleAA ? 'OK' : 'FALLO';
    if (estado !== 'OK') fallos += 1;
    console.log(
      `[${estado}] ${r.nombre}: ${r.colorFg} sobre ${r.colorBg} -> ${r.ratio}:1 (esperado: ${r.referenciaEsperada}:1, mín AA: ${r.minimoAA}:1)`
    );
  }

  if (fallos > 0) {
    console.error(`\nSe encontraron ${fallos} fallos de contraste.`);
    process.exit(1);
  } else {
    console.log('\nTodos los pares de color en ambos temas cumplen con las pautas WCAG 2.1 AA.');
  }
}
