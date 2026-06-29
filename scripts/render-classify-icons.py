#!/usr/bin/env python3
"""Render Classify PWA / favicon assets from classify.png."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "classify.png"
ASSET_VERSION = "1"

sys.path.insert(0, str(ROOT / "scripts"))
from pwa_icons import FAVICON_FILL, PWA_ANY_FILL, PWA_MASKABLE_FILL, fit_square  # noqa: E402

SIZES: list[tuple[int, float, str]] = [
    (32, FAVICON_FILL, "classify-favicon-32.png"),
    (48, FAVICON_FILL, "classify-favicon-48.png"),
    (96, FAVICON_FILL, "classify-favicon-96.png"),
    (128, FAVICON_FILL, "classify-favicon-128.png"),
    (180, PWA_ANY_FILL, "classify-favicon-180.png"),
    (192, PWA_ANY_FILL, "classify-favicon-192.png"),
    (512, PWA_ANY_FILL, "classify-favicon-512.png"),
    (192, PWA_MASKABLE_FILL, "classify-favicon-192-maskable.png"),
    (512, PWA_MASKABLE_FILL, "classify-favicon-512-maskable.png"),
]


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing {SOURCE}")
    logo = Image.open(SOURCE).convert("RGBA")

    ico_parts: list[Image.Image] = []
    for size, fill, name in SIZES:
        out = fit_square(logo, size, fill)
        out.save(ROOT / name, optimize=True)
        if size in (32, 48, 96, 128):
            ico_parts.append(out)
        print(f"wrote {name}")

    ico_parts[0].save(
        ROOT / "classify.ico",
        format="ICO",
        sizes=[(32, 32), (48, 48), (96, 96), (128, 128)],
        append_images=ico_parts[1:],
    )
    print("wrote classify.ico")


if __name__ == "__main__":
    main()
