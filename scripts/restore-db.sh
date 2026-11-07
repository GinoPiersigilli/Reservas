#!/usr/bin/env bash
# =============================================================================
# scripts/restore-db.sh
# Restaura un backup comprimido (.sql.gz) o plano (.sql) en PostgreSQL.
#
# Uso:
#   ./scripts/restore-db.sh <ruta_al_archivo.sql.gz> [--yes]
#
# Variables opcionales:
#   ENV_FILE        Ruta al archivo env (default: .env.production si existe, sino .env)
#   TARGET_DB       Base de datos destino (default: $POSTGRES_DB)
#   DB_CONTAINER    Nombre del contenedor Docker (autodetección: reservas-postgres-prod / reservas-db)
#   DATABASE_URL    URL de conexión directa si no se usa contenedor Docker
#   FORCE_RESTORE   Si es "true", omite la confirmación interactiva (equivalente a --yes)
# =============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 <ruta_al_backup.sql.gz> [--yes]" >&2
  exit 1
fi

BACKUP_FILE="$1"
AUTO_CONFIRM="${FORCE_RESTORE:-false}"
if [ "${2:-}" = "--yes" ] || [ "${2:-}" = "-y" ]; then
  AUTO_CONFIRM="true"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] ERROR: No existe el archivo de backup: $BACKUP_FILE" >&2
  exit 1
fi

if [[ "$BACKUP_FILE" == *.gz ]]; then
  if ! gzip -t "$BACKUP_FILE"; then
    echo "[restore] ERROR: El archivo comprimido está corrupto: $BACKUP_FILE" >&2
    exit 1
  fi
fi

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

POSTGRES_USER="${POSTGRES_USER:-reservas}"
POSTGRES_DB="${POSTGRES_DB:-reservas}"
TARGET_DB="${TARGET_DB:-$POSTGRES_DB}"

if [ "$AUTO_CONFIRM" != "true" ]; then
  read -r -p "[restore] ¿Confirmás restaurar '$BACKUP_FILE' sobre la base '$TARGET_DB'? (s/N): " respuesta
  case "$respuesta" in
    [sS]|[sS][iI]|[yY]|[yY][eE][sS]) ;;
    *)
      echo "[restore] Restauración cancelada por el usuario."
      exit 0
      ;;
  esac
fi

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

descomprimir_stream() {
  if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE"
  else
    cat "$BACKUP_FILE"
  fi
}

echo "[restore] Restaurando '$BACKUP_FILE' en la base de datos '$TARGET_DB'..."

if [ -n "$CONTAINER" ]; then
  echo "[restore] Usando contenedor Docker '$CONTAINER' (usuario: $POSTGRES_USER, base: $TARGET_DB)..."
  descomprimir_stream | docker exec -i "$CONTAINER" psql \
    -v ON_ERROR_STOP=1 \
    -U "$POSTGRES_USER" \
    -d "$TARGET_DB"
elif [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  echo "[restore] Usando psql local contra DATABASE_URL..."
  descomprimir_stream | psql -v ON_ERROR_STOP=1 "$DATABASE_URL"
else
  echo "[restore] ERROR: No se encontró un contenedor PostgreSQL activo ni psql con DATABASE_URL." >&2
  exit 1
fi

echo "[restore] Restauración completada exitosamente sobre '$TARGET_DB'."
