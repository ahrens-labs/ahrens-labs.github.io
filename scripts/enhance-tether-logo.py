#!/usr/bin/env python3
"""Prepare Tether logo PNG: remove gray checkerboard, brighten checkmark, center on 512² canvas."""
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


def foreground_mask(arr: np.ndarray) -> np.ndarray:
    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    bright = (r + g + b) / 3
    fg = (sat > 28) | (bright < 90) | ((r > 150) & (g > 120) & (b < 100))
    fg |= (b > 100) & (sat > 15)
    return fg


def checkmark_masks(arr: np.ndarray, fg: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    r = arr[..., 0]
    g = arr[..., 1]
    b = arr[..., 2]
    light = fg & (b > 135) & (g > 105) & (r < 130)
    medium = fg & (b > 85) & (g > 65) & (r < 85) & (b > r + 20)
    gold = fg & (r > 130) & (g > 100) & (b < 130) & (r > b + 15)
    return light | medium, gold


def boost_checkmark(arr: np.ndarray, fg: np.ndarray) -> np.ndarray:
    out = arr.copy()
    check, gold = checkmark_masks(arr, fg)
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    r[check] = np.clip(r[check] * 0.78, 0, 255)
    g[check] = np.clip(g[check] * 1.2, 0, 255)
    b[check] = np.clip(b[check] * 1.28, 0, 255)
    r[gold] = np.clip(r[gold] * 1.1, 0, 255)
    g[gold] = np.clip(g[gold] * 1.08, 0, 255)
    b[gold] = np.clip(b[gold] * 1.04, 0, 255)
    return out


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
    arr = rgba_array(Image.open(SRC))
    fg = foreground_mask(arr)
    out = arr.copy()
    out[~fg, 3] = 0
    out = boost_checkmark(out, fg)
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
    result = compose_canvas(im)
    result.save(OUT, optimize=True)
    print(f"Wrote {OUT} ({result.size[0]}x{result.size[1]}) from {SRC.name}")


if __name__ == "__main__":
    main()
