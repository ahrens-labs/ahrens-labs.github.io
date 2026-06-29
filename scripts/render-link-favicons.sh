#!/usr/bin/env bash
# Regenerate Link logo + PWA/favicon assets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$ROOT/scripts/render-link-logo.py"
