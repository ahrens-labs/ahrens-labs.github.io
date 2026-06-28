#!/usr/bin/env python3
"""Export Tether logo PNG from source artwork without altering the mark."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
SRC = IMG / "tether-logo-source.png"
if not SRC.exists():
    SRC = IMG / "tether-logo.png"
OUT = IMG / "tether-logo.png"


def rgba_array(im: Image.Image) -> np.ndarray:
    return np.array(im.convert("RGBA"), dtype=np.float32)


def checkerboard_mask(arr: np.ndarray) -> np.ndarray:
    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    bright = (r + g + b) / 3
    return (sat < 38) & (bright > 120)


def crop_foreground(im: Image.Image) -> Image.Image:
    arr = rgba_array(im)
    fg = ~checkerboard_mask(arr)
    if not np.any(fg):
        return im
    ys, xs = np.where(fg)
    pad = 2
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(arr.shape[1], int(xs.max()) + pad + 1)
    y1 = min(arr.shape[0], int(ys.max()) + pad + 1)
    return im.crop((x0, y0, x1, y1))


def remove_checkerboard(im: Image.Image) -> Image.Image:
    arr = rgba_array(im)
    bg = checkerboard_mask(arr)
    arr[bg, 3] = 0
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def compose_canvas(im: Image.Image, canvas: int = 512, fill: float = 0.94) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        raise RuntimeError("No opaque pixels found in logo")
    cropped = im.crop(bbox)
    target = int(canvas * fill)
    scale = target / max(cropped.size)
    nw = max(1, int(round(cropped.size[0] * scale)))
    nh = max(1, int(round(cropped.size[1] * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas_im = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    canvas_im.paste(resized, ((canvas - nw) // 2, (canvas - nh) // 2), resized)
    return canvas_im


def main() -> None:
    source = Image.open(SRC)
    cleaned = remove_checkerboard(crop_foreground(source))
    result = compose_canvas(cleaned)
    result.save(OUT, optimize=True)
    print(f"Wrote {OUT} ({result.size[0]}x{result.size[1]}) from {SRC.name}")


if __name__ == "__main__":
    main()
