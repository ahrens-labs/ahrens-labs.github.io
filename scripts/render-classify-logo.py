#!/usr/bin/env python3
"""Build Classify logo + favicons from img/classify-logo-source.png."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
IMG = ROOT / "img"
SOURCE = IMG / "classify-logo-source.png"
OUT_PNG = IMG / "classify-logo.png"
OUT_TOPBAR = ROOT / "classify.png"
CANVAS = 512
FILL = 0.98
ASSET_VERSION = "16"

# Wide logo: scale to height with this fill (allows slight horizontal crop vs filling width).
WIDE_HEIGHT_FILL = 0.58
CLASSIFY_FAVICON_FILL = 0.66
CLASSIFY_PWA_ANY_FILL = 0.62
CLASSIFY_PWA_MASKABLE_FILL = 0.52


def is_background(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    bright = (r.astype(np.float32) + g + b) / 3.0
    sat = np.maximum.reduce(
        [
            np.abs(r.astype(np.int16) - g),
            np.abs(g.astype(np.int16) - b),
            np.abs(r.astype(np.int16) - b),
        ]
    )
    return (bright > 210) & (sat < 20)


def load_source() -> Image.Image:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source artwork: {SOURCE}")
    arr = np.array(Image.open(SOURCE).convert("RGBA"))
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    bg = is_background(r, g, b)
    arr[bg, 3] = 0
    return Image.fromarray(arr, "RGBA")


def fit_canvas(im: Image.Image, canvas: int, fill: float) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        raise RuntimeError("Logo produced empty image")
    cropped = im.crop(bbox)
    target = int(canvas * fill)
    scale = target / max(cropped.size)
    nw = max(1, int(round(cropped.size[0] * scale)))
    nh = max(1, int(round(cropped.size[1] * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(resized, ((canvas - nw) // 2, (canvas - nh) // 2), resized)
    return out


def fit_classify_square(im: Image.Image, size: int, fill: float) -> Image.Image:
    """Scale wide Classify artwork for square favicons."""
    rgba = im.convert("RGBA")
    bbox = rgba.getbbox()
    if not bbox:
        raise RuntimeError("Empty image")
    cropped = rgba.crop(bbox)
    aspect = cropped.width / max(cropped.height, 1)
    if aspect > 1.2:
        target = max(1, int(round(size * WIDE_HEIGHT_FILL)))
        scale = target / cropped.height
    else:
        target = max(1, int(round(size * fill)))
        scale = target / max(cropped.size)
    nw = max(1, int(round(cropped.width * scale)))
    nh = max(1, int(round(cropped.height * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return out


FAVICON_SIZES: list[tuple[int, float, str]] = [
    (32, CLASSIFY_FAVICON_FILL, "classify-favicon-32.png"),
    (48, CLASSIFY_FAVICON_FILL, "classify-favicon-48.png"),
    (96, CLASSIFY_FAVICON_FILL, "classify-favicon-96.png"),
    (128, CLASSIFY_FAVICON_FILL, "classify-favicon-128.png"),
    (180, CLASSIFY_PWA_ANY_FILL, "classify-favicon-180.png"),
    (192, CLASSIFY_PWA_ANY_FILL, "classify-favicon-192.png"),
    (512, CLASSIFY_PWA_ANY_FILL, "classify-favicon-512.png"),
    (192, CLASSIFY_PWA_MASKABLE_FILL, "classify-favicon-192-maskable.png"),
    (512, CLASSIFY_PWA_MASKABLE_FILL, "classify-favicon-512-maskable.png"),
]


def write_favicons(logo: Image.Image) -> None:
    ico_parts: list[Image.Image] = []
    for size, fill, name in FAVICON_SIZES:
        out = fit_classify_square(logo, size, fill)
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

    section = fit_classify_square(logo, 128, CLASSIFY_PWA_ANY_FILL)
    section.save(IMG / "classify-logo-128.png", optimize=True)
    print("wrote img/classify-logo-128.png")


def main() -> None:
    logo = load_source()
    logo = logo.filter(ImageFilter.UnsharpMask(radius=1.0, percent=115, threshold=3))
    result = fit_canvas(logo, CANVAS, FILL)
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUT_PNG, optimize=True)
    result.save(OUT_TOPBAR, optimize=True)
    print(f"Wrote {OUT_PNG} ({result.size[0]}x{result.size[1]})")
    print(f"Wrote {OUT_TOPBAR}")
    write_favicons(result)


if __name__ == "__main__":
    main()
