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

export function verificarParesTokens() {
  const css = fs.readFileSync(rutaTokens, 'utf8');
  const tokens = extraerTokensHex(css);

  return PARES_PROPUESTA.map((par) => {
    const colorFg = tokens[par.fg];
    const colorBg = tokens[par.bg];
    const ratio = calcularContraste(colorFg, colorBg);
    const ratioRedondeado = Number(ratio.toFixed(1));
    const cumpleAA = ratio >= par.minimoAA;
    const coincidePropuesta = Math.abs(ratioRedondeado - par.referenciaPropuesta) <= 0.1;

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

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const resultados = verificarParesTokens();
  let fallos = 0;

  console.log('Verificación de contraste WCAG 2.1 sobre src/styles/tokens.css:\n');
  for (const r of resultados) {
    const estado = r.cumpleAA && r.coincidePropuesta ? 'OK' : 'FALLO';
    if (estado !== 'OK') fallos += 1;
    console.log(
      `[${estado}] ${r.nombre}: ${r.colorFg} sobre ${r.colorBg} -> ${r.ratio}:1 (propuesta: ${r.referenciaPropuesta}:1, mín AA: ${r.minimoAA}:1)`
    );
  }

  if (fallos > 0) {
    process.exit(1);
  }
}

