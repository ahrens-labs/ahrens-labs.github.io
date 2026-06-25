#!/usr/bin/env bash
# Regenerate Tether favicons from img/tether-logo.svg (requires npx, ImageMagick).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMG="$ROOT/img"
cd "$IMG"

cp tether-logo.svg tether-favicon.svg
for size in 16 32 48 180; do
  npx --yes @resvg/resvg-js-cli --fit-width "$size" tether-logo.svg "tether-favicon-${size}.png"
done
convert tether-favicon-16.png tether-favicon-32.png tether-favicon-48.png tether-favicon.ico
rm -f tether-favicon-16.png tether-favicon-48.png
echo "Updated tether-favicon.svg, -32.png, -180.png, .ico"
