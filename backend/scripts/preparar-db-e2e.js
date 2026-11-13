/**
 * Prepara la base de datos de pruebas E2E: aplica migraciones, vacía las
 * tablas y carga los datos de demostración.
 *
 * Guarda de seguridad: solo se ejecuta si el nombre de la base termina en
 * "_e2e", para que nunca pueda vaciar una base de desarrollo o producción.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sequelize } from 'sequelize';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(__dirname, '..');

const url = process.env.DATABASE_URL;
let nombreBase = '';
try {
  nombreBase = new URL(url).pathname.replace(/^\//, '');
} catch {
  console.error('DATABASE_URL no es una URL válida.');
  process.exit(1);
}

if (!nombreBase.endsWith('_e2e')) {
  console.error(
    `PELIGRO: la base "${nombreBase}" no termina en "_e2e". ` +
      'Este script vacía todas las tablas y solo puede usarse contra una base exclusiva de pruebas E2E.'
  );
  process.exit(1);
}

const cli = path.join(BACKEND, 'node_modules', 'sequelize-cli', 'lib', 'sequelize');
const ejecutarCli = (...args) => {
  const r = spawnSync(process.execPath, [cli, ...args], {
    cwd: BACKEND,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

ejecutarCli('db:migrate');

const sequelize = new Sequelize(url, { dialect: 'postgres', logging: false });
await sequelize.query(
  'TRUNCATE TABLE idempotency_keys, historial_aulas, historial_reservas, reservas, aulas, usuarios RESTART IDENTITY CASCADE;'
);
await sequelize.close();

ejecutarCli('db:seed:all');
console.log(`Base "${nombreBase}" lista para pruebas E2E.`);
