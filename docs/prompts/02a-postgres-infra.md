# Fase 2a — PostgreSQL: infraestructura
**Modo sugerido:** Planning. **Rama:** `mejora/fase-2a-postgres-infra`. **Riesgo:** bajo.

## Antes de pegar el prompt
- Tener Docker instalado y funcionando (`docker --version`).

## Prompt
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 2a — levantar PostgreSQL sin cambiar todavía el esquema ni los datos.

1. Reemplazá `docker-compose.yml`: quitá Keycloak y agregá un servicio `postgres` (imagen postgres:16-alpine, container_name reservas-db, puerto 5432, volumen nombrado `pgdata`, healthcheck con pg_isready, credenciales desde variables POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB leídas del .env de la raíz). Montá `docker/postgres/init/01-test-db.sql` en /docker-entrypoint-initdb.d para crear además la base `reservas_test`.
2. Creá un `.env.example` en la raíz con esas variables y actualizá `backend/.env.example` con DATABASE_URL y DATABASE_URL_TEST.
3. En backend instalá `pg` y `pg-hstore`. NO desinstales sqlite3 todavía.
4. Reescribí `backend/src/config/database.js`: usar DATABASE_URL (o DATABASE_URL_TEST si NODE_ENV=test) con dialect postgres. Validar la variable en config/env.js. Dejar `logging` controlado por una variable (LOG_SQL=true).
5. Dejá de llamar a `sequelize.sync()` con `alter`/`force`; por ahora, solo para poder arrancar, usá `sync()` normal (en 2b lo reemplazamos por migraciones).
6. Agregá scripts: `db:up` (docker compose up -d postgres), `db:down`, `db:logs`.
7. Actualizá el README con los pasos: copiar .env.example, `npm run db:up`, arrancar backend.
8. Verificá: Postgres sano, el backend conecta y crea tablas vacías, y `GET /api/aulas` responde (con el seed actual si corresponde).

Los tests todavía pueden fallar por el cambio de motor: reportá cuáles, no los arregles en esta fase. Al terminar: resumen y detenete.
```

## Cómo verificar
- `docker ps` muestra `reservas-db` en estado *healthy*.
- `docker exec -it reservas-db psql -U <usuario> -d reservas -c '\dt'` lista las tablas.
