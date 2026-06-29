#!/usr/bin/env bash
# Regenerate Tether favicons from img/tether-logo.png with safe padding for app icons.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMG="$ROOT/img"
cd "$IMG"

inner_size() {
  python3 - "$1" "$2" <<'PY'
import sys
print(max(1, int(round(float(sys.argv[1]) * float(sys.argv[2])))))
PY
}

render_padded_png() {
  local size="$1"
  local fill="$2"
  local out="$3"
  local inner
  inner="$(inner_size "$size" "$fill")"
  convert tether-logo.png \
    -resize "${inner}x${inner}" \
    -background none \
    -gravity center \
    -extent "${size}x${size}" \
    "$out"
}

if [[ ! -f tether-logo.png ]]; then
  echo "Missing img/tether-logo.png" >&2
  exit 1
fi

# Browser tab favicons.
render_padded_png 32 0.96 "tether-favicon-32.png"
render_padded_png 48 0.94 "tether-favicon-48.png"
render_padded_png 96 0.92 "tether-favicon-96.png"
render_padded_png 128 0.90 "tether-favicon-128.png"

# Home-screen / PWA icons — larger fill while keeping a small safe inset.
render_padded_png 180 0.90 "tether-favicon-180.png"
render_padded_png 192 0.90 "tether-favicon-192.png"
render_padded_png 512 0.90 "tether-favicon-512.png"
render_padded_png 192 0.84 "tether-favicon-192-maskable.png"
render_padded_png 512 0.84 "tether-favicon-512-maskable.png"

if [[ -f tether-logo.svg ]]; then
  cp tether-logo.svg tether-favicon.svg
else
  cp tether-logo.png tether-favicon.svg
fi

render_padded_png 16 0.92 "tether-favicon-16.png"
convert tether-favicon-16.png tether-favicon-32.png tether-favicon-48.png tether-favicon.ico
rm -f tether-favicon-16.png

echo "Updated tether favicons from tether-logo.png"
