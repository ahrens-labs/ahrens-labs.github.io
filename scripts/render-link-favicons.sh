#!/usr/bin/env bash
# Regenerate Link PWA/favicon assets and src/favicon.ts from workers/link-crm/link_logo.png
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRM="$ROOT/workers/link-crm"
cd "$CRM"

if [[ ! -f link_logo.png ]]; then
  echo "Missing workers/link-crm/link_logo.png" >&2
  exit 1
fi

render_icon() {
  local size="$1"
  local out="$2"
  convert link_logo.png -fuzz 12% -trim +repage \
    -resize "${size}x${size}" \
    -background none -gravity center -extent "${size}x${size}" \
    "$out"
}

render_icon 48 link_favicon-48.png
render_icon 192 link_icon-192.png
render_icon 512 link_icon-512.png
cp link_logo.png link_favicon.png

python3 <<'PY'
import base64
from pathlib import Path

root = Path('.').resolve()

def b64(name: str) -> str:
    return base64.b64encode((root / name).read_bytes()).decode('ascii')

(root / 'src' / 'favicon.ts').write_text(
    f"export const FAVICON_48_BASE64 = `{b64('link_favicon-48.png')}`;\n\n"
    f"export const ICON_192_BASE64 = `{b64('link_icon-192.png')}`;\n\n"
    f"export const ICON_512_BASE64 = `{b64('link_icon-512.png')}`;\n"
)
print('Updated workers/link-crm/src/favicon.ts')
PY

echo "Updated Link favicons from link_logo.png"
