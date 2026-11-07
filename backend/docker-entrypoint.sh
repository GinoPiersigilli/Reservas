#!/bin/sh
set -e

echo "[entrypoint] Ejecutando migraciones de base de datos (entorno: ${NODE_ENV:-production})..."
./node_modules/.bin/sequelize-cli db:migrate --env "${NODE_ENV:-production}"

echo "[entrypoint] Iniciando servidor backend..."
exec "$@"
