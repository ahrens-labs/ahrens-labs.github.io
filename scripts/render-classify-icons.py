#!/usr/bin/env python3
"""Regenerate Classify logo + favicons (delegates to render-classify-logo.py)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    subprocess.run([sys.executable, str(ROOT / "scripts" / "render-classify-logo.py")], check=True)


if __name__ == "__main__":
    main()
