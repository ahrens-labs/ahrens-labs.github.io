#!/usr/bin/env bash
# Regenerate Deck logo PNGs and favicons from img/deck-logo.svg.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$ROOT/scripts/render-deck-icons.py"
