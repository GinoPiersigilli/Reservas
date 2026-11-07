#!/usr/bin/env bash
# =============================================================================
# scripts/backup-db.sh
# Genera un backup comprimido (.sql.gz) de PostgreSQL con fecha en el nombre
# y conserva únicamente los últimos 7 backups (rotación automática).
#
# Uso:
#   ./scripts/backup-db.sh
#
# Variables opcionales:
#   ENV_FILE        Ruta al archivo env (default: .env.production si existe, sino .env)
#   BACKUP_DIR      Carpeta destino (default: ./backups)
#   RETENTION_COUNT Cantidad de backups a retener (default: 7)
#   DB_CONTAINER    Nombre del contenedor Docker (autodetección: reservas-postgres-prod / reservas-db)
#   DATABASE_URL    URL de conexión directa si no se usa contenedor Docker
#
# Ejemplo de programación en cron (todos los días a las 03:00 AM):
#   0 3 * * * cd /opt/reservas && /opt/reservas/scripts/backup-db.sh >> /var/log/reservas-backup.log 2>&1
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-}"

if [ -z "$ENV_FILE" ]; then
  if [ -f "$ROOT_DIR/.env.production" ]; then
    ENV_FILE="$ROOT_DIR/.env.production"
  elif [ -f "$ROOT_DIR/.env" ]; then
    ENV_FILE="$ROOT_DIR/.env"
  fi
fi

if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source <(tr -d '\r' < "$ENV_FILE")
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_COUNT="${RETENTION_COUNT:-7}"
POSTGRES_USER="${POSTGRES_USER:-reservas}"
POSTGRES_DB="${POSTGRES_DB:-reservas}"
TIMESTAMP="$(date +"%Y-%m-%d_%H%M%S")"
BACKUP_FILE="$BACKUP_DIR/reservas_${TIMESTAMP}.sql.gz"
TMP_FILE="${BACKUP_FILE}.tmp"

mkdir -p "$BACKUP_DIR"

detectar_contenedor() {
  if [ -n "${DB_CONTAINER:-}" ]; then
    echo "$DB_CONTAINER"
    return
  fi
  if command -v docker >/dev/null 2>&1; then
    for candidate in reservas-postgres-prod reservas-db; do
      if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$candidate"; then
        echo "$candidate"
        return
      fi
    done
  fi
  echo ""
}

CONTAINER="$(detectar_contenedor)"

echo "[backup] Iniciando backup de la base de datos '$POSTGRES_DB'..."

if [ -n "$CONTAINER" ]; then
  echo "[backup] Usando contenedor Docker '$CONTAINER' (usuario: $POSTGRES_USER)..."
  docker exec -i "$CONTAINER" pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    | gzip -9 > "$TMP_FILE"
elif [ -n "${DATABASE_URL:-}" ] && command -v pg_dump >/dev/null 2>&1; then
  echo "[backup] Usando pg_dump local contra DATABASE_URL..."
  pg_dump "$DATABASE_URL" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    | gzip -9 > "$TMP_FILE"
else
  echo "[backup] ERROR: No se encontró un contenedor PostgreSQL activo ni pg_dump con DATABASE_URL." >&2
  rm -f "$TMP_FILE"
  exit 1
fi

# Verificar que el archivo comprimido sea válido y no esté vacío
if [ ! -s "$TMP_FILE" ] || ! gzip -t "$TMP_FILE"; then
  echo "[backup] ERROR: El archivo de backup generado está vacío o corrupto." >&2
  rm -f "$TMP_FILE"
  exit 1
fi

mv "$TMP_FILE" "$BACKUP_FILE"
echo "[backup] Backup creado exitosamente: $BACKUP_FILE"

# Retención: conservar únicamente los últimos $RETENTION_COUNT backups
echo "[backup] Aplicando política de retención (últimos $RETENTION_COUNT backups)..."
contador=0
for archivo in $(ls -1t "$BACKUP_DIR"/reservas_*.sql.gz 2>/dev/null || true); do
  contador=$((contador + 1))
  if [ "$contador" -gt "$RETENTION_COUNT" ]; then
    echo "[backup] Eliminando backup antiguo: $archivo"
    rm -f "$archivo"
  fi
done

echo "[backup] Proceso finalizado correctamente."
