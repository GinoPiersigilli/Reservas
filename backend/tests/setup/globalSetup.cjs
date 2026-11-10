'use strict';

const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

function validarDatabaseUrlTest(testDbUrl, prodOrDevDbUrl) {
  if (!testDbUrl || !String(testDbUrl).trim()) {
    throw new Error('DATABASE_URL_TEST no está definida para correr los tests');
  }

  if (prodOrDevDbUrl && String(testDbUrl).trim() === String(prodOrDevDbUrl).trim()) {
    throw new Error('PELIGRO: DATABASE_URL_TEST no puede ser igual a DATABASE_URL');
  }

  let dbName;
  try {
    const parsedUrl = new URL(testDbUrl);
    dbName = parsedUrl.pathname.replace(/^\//, '');
  } catch {
    throw new Error('DATABASE_URL_TEST no es una URL válida');
  }

  if (!dbName || !dbName.endsWith('_test')) {
    throw new Error(
      `PELIGRO: La base de datos de test ('${dbName}') debe terminar obligatoriamente en '_test' para evitar destruir datos de desarrollo o producción`
    );
  }

  return dbName;
}

const TEST_ADVISORY_LOCK_ID = 987654321;

async function globalSetup() {
  const testDbUrl = process.env.DATABASE_URL_TEST;
  validarDatabaseUrlTest(testDbUrl, process.env.DATABASE_URL);

  const client = new Client({ connectionString: testDbUrl });
  await client.connect();
  try {
    // 1. Adquirir advisory lock exclusivo para evitar ejecuciones simultáneas de tests
    await client.query('SELECT pg_advisory_lock($1);', [TEST_ADVISORY_LOCK_ID]);

    // 2. Terminar conexiones activas residuales a la base de tests antes del DROP
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid();
    `);

    // 3. Recrear el esquema limpio
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1);', [TEST_ADVISORY_LOCK_ID]);
    } catch {}
    await client.end();
  }

  const backendRoot = path.resolve(__dirname, '..', '..');
  execSync('npx sequelize-cli db:migrate --env test', {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });
}

module.exports = globalSetup;
module.exports.validarDatabaseUrlTest = validarDatabaseUrlTest;
