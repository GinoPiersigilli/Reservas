'use strict';

const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

module.exports = async function globalSetup() {
  const testDbUrl = process.env.DATABASE_URL_TEST;
  if (!testDbUrl) {
    throw new Error('DATABASE_URL_TEST no está definida para correr los tests');
  }

  const client = new Client({ connectionString: testDbUrl });
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  } finally {
    await client.end();
  }

  const backendRoot = path.resolve(__dirname, '..', '..');
  execSync('npx sequelize-cli db:migrate --env test', {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });
};
