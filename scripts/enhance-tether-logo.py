#!/usr/bin/env python3
"""Prepare Tether logo PNG: lighten rings, enlarge centered checkmark, export 512² PNG."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
SRC = IMG / "tether-logo-source.png"
if not SRC.exists():
    SRC = IMG / "tether-logo.png"
OUT = IMG / "tether-logo.png"

CHECK_SCALE = 1.18
RING_RGB_MULT = (1.35, 1.12, 1.04)
RING_RGB_ADD = (18.0, 22.0, 8.0)


def rgba_array(im: Image.Image) -> np.ndarray:
    return np.array(im.convert("RGBA"), dtype=np.float32)


def background_mask(arr: np.ndarray) -> np.ndarray:
    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    bright = (r + g + b) / 3
    return (sat < 38) & (bright > 120)


def split_layers(arr: np.ndarray, fg: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    bright = (r + g + b) / 3

    check_body = fg & (bright < 95) & (b > 20) & (sat > 15)
    check_dilated = np.array(Image.fromarray((check_body.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(7))) > 127
    white_edge = fg & check_dilated & ~check_body & (bright > 120) & (sat < 45)
    check = check_body | white_edge
    rings = fg & ~check & (bright > 80) & (b > 100) & (sat > 20)
    weave = fg & ~check & ~rings & (bright > 150) & (sat < 40)
    return check, rings, weave


def lighten_rings(arr: np.ndarray, rings: np.ndarray) -> np.ndarray:
    out = arr.copy()
    for idx, mult, add in zip(range(3), RING_RGB_MULT, RING_RGB_ADD):
        channel = out[..., idx]
        channel[rings] = np.clip(channel[rings] * mult + add, 0, 255)
        out[..., idx] = channel
    return out


def layer_centroid(alpha: np.ndarray) -> tuple[float, float]:
    ys, xs = np.where(alpha > 20)
    if xs.size == 0:
        raise RuntimeError("Layer has no opaque pixels")
    return float(xs.mean()), float(ys.mean())


def enlarge_check_layer(check_im: Image.Image, links_centroid: tuple[float, float]) -> Image.Image:
    bbox = check_im.getbbox()
    if not bbox:
        raise RuntimeError("Checkmark layer is empty")
    x0, y0, x1, y1 = bbox
    crop = check_im.crop(bbox)
    cw, ch = crop.size
    nw = max(1, int(round(cw * CHECK_SCALE)))
    nh = max(1, int(round(ch * CHECK_SCALE)))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    # Grow from the check's lower-left so the short leg extends down-left.
    paste_x = x0
    paste_y = y1 - nh + 1

    w, h = check_im.size
    placed = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    placed.paste(scaled, (paste_x, paste_y), scaled)

    alpha = np.array(placed)[..., 3]
    cx, cy = layer_centroid(alpha)
    lx, ly = links_centroid
    shift_x = int(round(lx - cx))
    shift_y = int(round(ly - cy))

    shifted = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shifted.paste(placed, (shift_x, shift_y), placed)
    return shifted


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
    fg = ~background_mask(arr)
    check, rings, weave = split_layers(arr, fg)

    out = arr.copy()
    out[~fg, 3] = 0
    out = lighten_rings(out, rings)

    links_arr = np.zeros_like(out)
    links_arr[rings] = out[rings]
    links_arr[weave] = out[weave]

    check_arr = np.zeros_like(out)
    check_arr[check] = out[check]

    links_im = Image.fromarray(np.clip(links_arr, 0, 255).astype(np.uint8), "RGBA")
    check_im = Image.fromarray(np.clip(check_arr, 0, 255).astype(np.uint8), "RGBA")
    links_centroid = layer_centroid(np.array(links_im)[..., 3])

    enlarged_check = enlarge_check_layer(check_im, links_centroid)
    composed = Image.alpha_composite(links_im, enlarged_check)
    result = compose_canvas(composed)
    result.save(OUT, optimize=True)
    print(f"Wrote {OUT} ({result.size[0]}x{result.size[1]}) from {SRC.name}")


if __name__ == "__main__":
    main()
