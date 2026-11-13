#!/usr/bin/env bash
#
# Convierte el video que graba `capturas/recorrido.spec.js` en el GIF del
# README. Se ejecuta desde `npm run gif --prefix e2e`, después de la grabación.
#
# Requiere ffmpeg. El GIF se arma en dos pasadas: la primera calcula una paleta
# de 128 colores a partir de todos los cuadros y la segunda la aplica con
# difuminado de Bayer. En una pasada sola, ffmpeg usa una paleta fija de 256
# colores web y las superficies grises de la interfaz salen con bandas.
set -euo pipefail

DIR_E2E="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="$DIR_E2E/../docs/img/recorrido.gif"
SALIDA="$DIR_E2E/salida-capturas"

if ! command -v ffmpeg > /dev/null 2>&1; then
  echo "Falta ffmpeg: es lo que convierte el video a GIF." >&2
  exit 1
fi

VIDEO="$(find "$SALIDA" -name '*.webm' -type f -print0 2> /dev/null | xargs -0 ls -t 2> /dev/null | head -1 || true)"

if [ -z "$VIDEO" ]; then
  echo "No hay ningún video en $SALIDA. ¿Corrió la grabación?" >&2
  exit 1
fi

PALETA="$(mktemp -t paleta-XXXXXX.png)"
trap 'rm -f "$PALETA"' EXIT

# 10 cuadros por segundo y 960 px de ancho: suficiente para leer la interfaz
# sin que el archivo se vuelva impracticable en un README.
FILTRO="fps=10,scale=960:-1:flags=lanczos"

ffmpeg -loglevel error -y -i "$VIDEO" -vf "$FILTRO,palettegen=max_colors=128:stats_mode=diff" "$PALETA"
ffmpeg -loglevel error -y -i "$VIDEO" -i "$PALETA" \
  -lavfi "$FILTRO [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  -loop 0 "$DESTINO"

echo "GIF escrito en docs/img/recorrido.gif ($(du -h "$DESTINO" | cut -f1))"
