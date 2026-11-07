# Guía de Despliegue y Operaciones — Sistema de Reservas de Aulas

Este documento detalla cómo preparar, desplegar, monitorear, respaldar y revertir cambios en producción para el **Sistema de Reservas de Aulas**.

---

## 1. Arquitectura de Producción

El despliegue con `docker-compose.prod.yml` levanta tres servicios conectados mediante la red interna `reservas-net`:

1. **`postgres` (`postgres:16-alpine`):**
   - Almacena los datos de forma persistente en el volumen nombrado `pgdata_prod`.
   - **No expone el puerto `5432` al host**; solo es accesible desde la red interna `reservas-net`.
   - Cuenta con `healthcheck` mediante `pg_isready`.
2. **`backend` (`backend/Dockerfile`):**
   - Imagen *multi-stage* basada en `node:20-alpine` con `NODE_ENV=production`.
   - Se ejecuta bajo el usuario sin privilegios `node` (no root).
   - No incluye tests ni seeders (`db/seeders` y `tests` están excluidos en `.dockerignore` y fuera de la etapa `production`).
   - Su entrypoint (`backend/docker-entrypoint.sh`) ejecuta explícitamente `./node_modules/.bin/sequelize-cli db:migrate --env production` antes de iniciar el servidor (`node index.js`). **Nunca ejecuta `sequelize.sync()` ni los seeders.**
   - Publica el puerto `3001` ligado únicamente a `127.0.0.1` (`127.0.0.1:${BACKEND_PORT:-3001}:3001`) para diagnóstico local sin exponerlo a interfaces públicas del servidor.
   - Incluye `healthcheck` contra `GET /api/health`.
3. **`frontend` (`frontend/Dockerfile` + `frontend/nginx.conf`):**
   - Etapa 1 (`build`): compila la aplicación React + Vite estática (`npm run build`).
   - Etapa 2 (`production`): sirve los archivos estáticos desde `nginx:1.27-alpine`, maneja rutas de React Router (`try_files $uri $uri/ /index.html`) y actúa como proxy inverso reenviando `/api/` hacia `http://backend:3001/api/`.

> **Despliegue alternativo con PostgreSQL gestionado (Neon, RDS, Supabase, Railway):**
> Si se utiliza una base de datos gestionada externa en lugar del servicio `postgres` de Docker Compose, asegurate de que el proveedor permita habilitar la extensión `btree_gist` (`CREATE EXTENSION IF NOT EXISTS btree_gist;`), requerida por la migración `002-esquema-definitivo.cjs` para la restricción de exclusión `reservas_sin_solapamiento`.

---

## 2. Variables de Entorno Obligatorias

Las variables de producción se leen desde el archivo `.env.production` en la raíz del proyecto (**no versionado en git**). Usá `.env.production.example` como plantilla:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

| Variable | Obligatoria | Descripción | Ejemplo en producción |
|---|---|---|---|
| `NODE_ENV` | Sí | Entorno de ejecución del backend | `production` |
| `POSTGRES_USER` | Sí (Docker DB) | Usuario del motor PostgreSQL | `reservas_prod` |
| `POSTGRES_PASSWORD` | Sí (Docker DB) | Contraseña de PostgreSQL (alta entropía) | `<generar con openssl rand -hex 24>` |
| `POSTGRES_DB` | Sí (Docker DB) | Nombre de la base de datos | `reservas` |
| `DATABASE_URL` | **Sí** | URL de conexión que usan el backend y `sequelize-cli` | `postgres://reservas_prod:<password>@postgres:5432/reservas` |
| `JWT_SECRET` | **Sí** | Clave secreta para firmar y verificar tokens JWT locales | `<generar con openssl rand -hex 32>` |
| `CLERK_SECRET_KEY` | **Sí** (en `production`) | Clave secreta de Clerk de producción (`src/config/env.js` aborta el arranque si falta en `production`) | `sk_live_...` |
| `VITE_CLERK_PUBLISHABLE_KEY` | **Sí** | Clave pública de Clerk de producción inyectada en el build de Vite | `pk_live_...` |
| `CORS_ORIGINS` | **Sí** | Orígenes permitidos separados por coma (sin `/` final) | `https://reservas.tudominio.edu.ar` |
| `VITE_API_BASE_URL` | Opcional | URL base de la API consumida por el frontend | `/api` (usa el proxy de Nginx) |
| `PORT` | Opcional | Puerto interno del servidor Express | `3001` |
| `WORK_HOUR_START` | Opcional | Hora de inicio de la franja laboral | `08:00` |
| `WORK_HOUR_END` | Opcional | Hora de fin de la franja laboral | `22:00` |
| `LOG_SQL` | Opcional | Impresión de consultas SQL por consola | `false` |
| `FRONTEND_PORT` | Opcional | Puerto publicado por Nginx en el host | `80` (o `8080` detrás de proxy TLS) |
| `BACKEND_PORT` | Opcional | Puerto publicado en `127.0.0.1` para el backend | `3001` |

---

## 3. Pasos de Despliegue

### 3.1. Preparación inicial en el servidor (VPS)
1. Clonar el repositorio y posicionarse en la rama o tag de lanzamiento:
   ```bash
   git clone <URL_DEL_REPOSITORIO> /opt/reservas
   cd /opt/reservas
   ```
2. Crear y configurar `.env.production` a partir de la plantilla:
   ```bash
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```
   Editar `.env.production` con secretos reales (`POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `CORS_ORIGINS`).

### 3.2. Construcción y puesta en marcha
Ejecutar Docker Compose indicando el archivo de entorno y el archivo de composición de producción:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

> **Nota:** Los servicios `postgres` y `backend` cargan automáticamente `.env.production` mediante `env_file:`. Pasar `--env-file .env.production` en la línea de comandos permite además interpolar los argumentos de build del frontend (`VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`) y los puertos del host (`FRONTEND_PORT`, `BACKEND_PORT`).

### 3.3. Verificación post-despliegue (`GET /api/health`)
1. Verificar el estado y healthchecks de los contenedores:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
2. Consultar el endpoint de salud (público, sin autenticación) que verifica la conectividad real con PostgreSQL:
   ```bash
   # Directo contra el backend en loopback
   curl -i http://127.0.0.1:3001/api/health

   # A través del proxy inverso Nginx del frontend
   curl -i http://localhost/api/health
   ```
   Respuesta esperada (`200 OK`):
   ```json
   {
     "status": "ok",
     "db": "ok",
     "timestamp": "2026-11-07T19:30:00.000Z"
   }
   ```
   Si la base de datos no responde, el endpoint devuelve `503 Service Unavailable` con `{"status":"error","db":"disconnected",...}`.

---

## 4. Backups y Restauración de Base de Datos

### 4.1. Generar un backup (`scripts/backup-db.sh`)
El script `scripts/backup-db.sh` ejecuta `pg_dump` con las opciones `--clean --if-exists --no-owner --no-acl`, comprime la salida con `gzip -9`, verifica la integridad del archivo `.sql.gz` y **conserva únicamente los últimos 7 backups** en la carpeta `backups/`:

```bash
chmod +x scripts/backup-db.sh scripts/restore-db.sh
./scripts/backup-db.sh
```

Archivo generado:
```text
backups/reservas_YYYY-MM-DD_HHMMSS.sql.gz
```

### 4.2. Programar backups automáticos con `cron`
Para ejecutar el backup automáticamente todos los días a las **03:00 AM** y conservar los últimos 7 días:

1. Abrir el crontab del usuario de despliegue:
   ```bash
   crontab -e
   ```
2. Agregar la siguiente línea (ajustando `/opt/reservas` a la ruta real del proyecto):
   ```cron
   0 3 * * * cd /opt/reservas && /opt/reservas/scripts/backup-db.sh >> /var/log/reservas-backup.log 2>&1
   ```

### 4.3. Restaurar un backup (`scripts/restore-db.sh`)
Para restaurar un backup sobre la base de datos de producción:

```bash
./scripts/restore-db.sh backups/reservas_2026-11-07_030000.sql.gz
```
Para ejecución no interactiva (scripts o automatizaciones), pasar `--yes`:
```bash
./scripts/restore-db.sh backups/reservas_2026-11-07_030000.sql.gz --yes
```

### 4.4. Verificar un backup en una base vacía
Para comprobar que un backup reproduce íntegramente el esquema y los datos sin afectar la base principal:

```bash
# 1. Crear una base temporal vacía en el contenedor
docker exec -i reservas-postgres-prod psql -U reservas_prod -d postgres -c "DROP DATABASE IF EXISTS reservas_verify; CREATE DATABASE reservas_verify;"

# 2. Restaurar el backup apuntando a TARGET_DB=reservas_verify
TARGET_DB=reservas_verify ./scripts/restore-db.sh backups/reservas_2026-11-07_030000.sql.gz --yes

# 3. Comprobar conteos y eliminar la base temporal
docker exec -i reservas-postgres-prod psql -U reservas_prod -d reservas_verify -c "SELECT COUNT(*) FROM usuarios; SELECT COUNT(*) FROM aulas; SELECT COUNT(*) FROM reservas;"
docker exec -i reservas-postgres-prod psql -U reservas_prod -d postgres -c "DROP DATABASE reservas_verify;"
```

---

## 5. Rollback de una Migración

Si una nueva versión introduce una migración que debe revertirse:

1. **Tomar un backup preventivo antes de tocar el esquema:**
   ```bash
   ./scripts/backup-db.sh
   ```
2. **Revertir la última migración aplicada usando `sequelize-cli` dentro del contenedor `backend`:**
   ```bash
   docker compose -f docker-compose.prod.yml exec backend \
     ./node_modules/.bin/sequelize-cli db:migrate:undo --env production
   ```
   - Para revertir hasta una migración específica:
     ```bash
     docker compose -f docker-compose.prod.yml exec backend \
       ./node_modules/.bin/sequelize-cli db:migrate:undo:all --to 001-baseline.cjs --env production
     ```
3. **Desplegar el commit/tag anterior del código:**
   ```bash
   git checkout <tag_o_commit_anterior>
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
   ```
4. **Verificar salud del servicio:**
   ```bash
   curl -f http://127.0.0.1:3001/api/health
   ```

---

## 6. Revisión de Seguridad para Producción

Antes de exponer el sistema en producción, verificar los siguientes puntos sobre los archivos y configuraciones del proyecto:

1. **Secretos y archivos `.env`:**
   - `.env` y `.env.production` están excluidos en `.gitignore` y en los `.dockerignore` de `backend/` y `frontend/`.
   - Solo se versionan plantillas con marcadores de posición (`.env.example`, `.env.production.example`, `backend/.env.example`, `frontend/.env.example`).
   - En `NODE_ENV=production`, `backend/src/config/env.js` aborta el arranque si faltan `JWT_SECRET`, `CLERK_SECRET_KEY` o `DATABASE_URL`.
2. **Puertos y red en `docker-compose.prod.yml`:**
   - **PostgreSQL (`5432`)** no publica puertos al host (`ports:` omitido); solo es accesible desde la red interna `reservas-net`.
   - **Backend (`3001`)** se publica ligado exclusivamente a `127.0.0.1` (`127.0.0.1:${BACKEND_PORT:-3001}:3001`), evitando acceso directo desde redes externas.
   - **Frontend (`80`)** sirve la SPA compilada mediante Nginx y proxifica `/api/` internamente hacia `http://backend:3001/api/`.
3. **Contenedores y ciclo de arranque:**
   - `backend/Dockerfile` utiliza construcción *multi-stage*, corre bajo el usuario sin privilegios `node` (no root) y define `NODE_ENV=production`.
   - `db/seeders` y `tests` están excluidos de la imagen de producción; el entrypoint (`backend/docker-entrypoint.sh`) ejecuta únicamente `sequelize-cli db:migrate` y nunca `sequelize.sync()` ni `db:seed:all`.
4. **Configuraciones de desarrollo a tener en cuenta:**
   - **`CORS_ORIGINS` (`backend/src/config/env.js`):** Si no se define la variable `CORS_ORIGINS`, el valor por defecto cae en `http://localhost:5173`. En `.env.production` **siempre** debe definirse explícitamente el dominio real de producción (ej. `CORS_ORIGINS=https://reservas.tudominio.edu.ar`).
   - **Credenciales de demostración visibles en `frontend/src/pages/Login.jsx`:** El componente de login local muestra un recuadro informativo con las credenciales del seed (`admin@utnfrc.edu.ar / admin123` y `david@utnfrc.edu.ar / user123`). Dado que en producción **no se ejecuta el seed**, esas cuentas no existirán en una base limpia, pero si se migraron datos históricos desde desarrollo se recomienda eliminar o desactivar esos usuarios de prueba (`activo = false`) o cambiar sus contraseñas antes de abrir el sistema al público.
   - **Fallback de URL de API en frontend (`frontend/src/services/axios.js` y `frontend/src/context/AuthContext.jsx`):** Si `VITE_API_BASE_URL` no se define en tiempo de build, el cliente usa `http://localhost:3001/api` como fallback. En `frontend/Dockerfile` y `docker-compose.prod.yml` se establece por defecto `VITE_API_BASE_URL=/api` para que todas las peticiones pasen por el mismo origen a través de Nginx.

