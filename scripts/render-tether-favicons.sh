#!/usr/bin/env bash
# Regenerate Tether favicons from img/tether-logo.png (preferred) or img/tether-logo.svg.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMG="$ROOT/img"
cd "$IMG"

if [[ -f tether-logo.png ]]; then
  for size in 16 32 48 96 128 180 192 512; do
    convert tether-logo.png -resize "${size}x${size}" "tether-favicon-${size}.png"
  done
  if [[ -f tether-logo.svg ]]; then
    cp tether-logo.svg tether-favicon.svg
  else
    cp tether-logo.png tether-favicon.svg
  fi
else
  cp tether-logo.svg tether-favicon.svg
  for size in 16 32 48 96 128 180 192 512; do
    npx --yes @resvg/resvg-js-cli --fit-width "$size" tether-logo.svg "tether-favicon-${size}.png"
  done
fi

convert tether-favicon-16.png tether-favicon-32.png tether-favicon-48.png tether-favicon.ico
rm -f tether-favicon-16.png
echo "Updated tether favicons from tether-logo.png or tether-logo.svg"
