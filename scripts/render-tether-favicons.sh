#!/usr/bin/env bash
# Regenerate Tether logo + favicons from the shared Python renderer.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$ROOT/scripts/render-tether-logo.py"
