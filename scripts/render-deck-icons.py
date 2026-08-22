#!/usr/bin/env python3
"""Regenerate Deck logo PNGs and favicons from img/deck-logo.svg."""
from __future__ import annotations

import sys
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from pwa_icons import FAVICON_FILL, PWA_ANY_FILL, PWA_MASKABLE_FILL, fit_square  # noqa: E402

IMG = ROOT / "img"
SOURCE_SVG = IMG / "deck-logo.svg"
OUT_FAVICON_SVG = IMG / "deck-favicon.svg"
CANVAS = 512

DECK_FAVICON_FILL = 0.88
DECK_PWA_ANY_FILL = 0.84
DECK_PWA_MASKABLE_FILL = 0.72

FAVICON_SIZES: list[tuple[int, float, str]] = [
    (32, DECK_FAVICON_FILL, "deck-favicon-32.png"),
    (48, DECK_FAVICON_FILL, "deck-favicon-48.png"),
    (96, DECK_FAVICON_FILL, "deck-favicon-96.png"),
    (128, DECK_FAVICON_FILL, "deck-favicon-128.png"),
    (180, DECK_PWA_ANY_FILL, "deck-favicon-180.png"),
    (192, DECK_PWA_ANY_FILL, "deck-favicon-192.png"),
    (512, DECK_PWA_ANY_FILL, "deck-favicon-512.png"),
    (192, DECK_PWA_MASKABLE_FILL, "deck-favicon-192-maskable.png"),
    (512, DECK_PWA_MASKABLE_FILL, "deck-favicon-512-maskable.png"),
]


def load_logo() -> Image.Image:
    if not SOURCE_SVG.exists():
        raise FileNotFoundError(f"Missing source artwork: {SOURCE_SVG}")
    svg = SOURCE_SVG.read_text(encoding="utf-8")
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=CANVAS, output_height=CANVAS)
    return Image.open(BytesIO(png)).convert("RGBA")


def write_favicons(logo: Image.Image) -> None:
    OUT_FAVICON_SVG.write_text(SOURCE_SVG.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"wrote {OUT_FAVICON_SVG.relative_to(ROOT)}")

    ico_parts: list[Image.Image] = []
    for size, fill, name in FAVICON_SIZES:
        out = fit_square(logo, size, fill)
        out.save(IMG / name, optimize=True)
        if size in (32, 48, 96, 128):
            ico_parts.append(out)
        print(f"wrote img/{name}")

    ico_parts[0].save(
        IMG / "deck-favicon.ico",
        format="ICO",
        sizes=[(32, 32), (48, 48), (96, 96), (128, 128)],
        append_images=ico_parts[1:],
    )
    print("wrote img/deck-favicon.ico")

    fit_square(logo, 128, PWA_ANY_FILL).save(IMG / "deck-logo-128.png", optimize=True)
    print("wrote img/deck-logo-128.png")

    logo.save(IMG / "deck-logo.png", optimize=True)
    print("wrote img/deck-logo.png")


def main() -> None:
    write_favicons(load_logo())


if __name__ == "__main__":
    main()
