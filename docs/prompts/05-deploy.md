# Fase 5 — Deploy y backups (opcional)
**Modo sugerido:** Planning. **Rama:** `mejora/fase-5-deploy`. **Riesgo:** medio.

## Antes de pegar el prompt
Decidí dónde va a vivir: un VPS con Docker Compose, o una plataforma con Postgres gestionado. La elección cambia solo el último punto; el resto es igual.

## Prompt
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 5 — preparar el deploy. No despliegues nada ni uses credenciales reales; solo dejá todo listo.

1. Dockerfile del backend (multi-stage, usuario no root, NODE_ENV=production) y del frontend (build de Vite servido por nginx o como estático), con .dockerignore.
2. docker-compose.prod.yml: backend, frontend, postgres con volumen y healthchecks. Las variables vienen de un archivo .env.production NO versionado (dejá .env.production.example).
3. El backend debe correr las migraciones al arrancar en producción (comando explícito en el entrypoint, no sync()) y NUNCA el seed.
4. Script `scripts/backup-db.sh`: pg_dump comprimido con fecha en el nombre y retención de los últimos 7; y `scripts/restore-db.sh`. Documentá cómo programarlo (cron).
5. Endpoint GET /api/health (sin auth) que verifique la conexión a la base.
6. docs/DEPLOY.md: pasos de despliegue, variables obligatorias (incluyendo CORS_ORIGINS, claves de Clerk de producción), cómo restaurar un backup y cómo hacer rollback de una migración.
7. Revisión final de seguridad: listá cualquier secreto, puerto o configuración de desarrollo que haya quedado expuesto en los archivos de producción.

Al terminar: resumen y detenete.
```

## Cómo verificar
- `docker compose -f docker-compose.prod.yml up --build` en local levanta todo y `/api/health` responde.
- Un backup restaurado en una base vacía reproduce los datos.
