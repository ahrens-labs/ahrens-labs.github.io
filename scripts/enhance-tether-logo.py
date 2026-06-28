#!/usr/bin/env python3
"""Prepare Tether logo PNG: lighten rings, enlarge centered checkmark, export 512² PNG."""
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

CHECK_SCALE = 1.18
CHECK_OFFSET_X = 12.0  # nudge right
CHECK_OFFSET_Y = -14.0  # nudge up
RING_RGB_MULT = (1.25, 1.08, 1.02)
RING_RGB_ADD = (12.0, 16.0, 6.0)
RING_CHANNEL_MAX = (180.0, 224.0, 248.0)
CHECK_RGB = (15.0, 40.0, 85.0)


def rgba_array(im: Image.Image) -> np.ndarray:
    return np.array(im.convert("RGBA"), dtype=np.float32)


def background_mask(arr: np.ndarray) -> np.ndarray:
    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    bright = (r + g + b) / 3
    return (sat < 38) & (bright > 120)


def split_layers(arr: np.ndarray, fg: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    bright = (r + g + b) / 3

    check_body = fg & (bright < 95) & (b > 20) & (sat > 15)
    check = check_body.copy()
    rings = fg & ~check & (bright > 80) & (b > 100) & (sat > 20)
    weave = fg & ~check & ~rings & (bright > 150) & (sat < 40)
    return check_body, check, rings, weave


def lighten_rings(arr: np.ndarray, rings: np.ndarray) -> np.ndarray:
    out = arr.copy()
    for idx, (mult, add, cap) in enumerate(zip(RING_RGB_MULT, RING_RGB_ADD, RING_CHANNEL_MAX)):
        channel = out[..., idx]
        channel[rings] = np.clip(channel[rings] * mult + add, 0, cap)
        out[..., idx] = channel
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    bright = (r + g + b) / 3
    bleached = rings & (bright > 210) & (g > 215) & (b > 215)
    out[bleached, 0] = np.clip(r[bleached] * 0.72, 90, 175)
    out[bleached, 1] = np.clip(g[bleached] * 0.92, 170, 228)
    out[bleached, 2] = np.clip(b[bleached], 210, 248)
    return out


def mask_bbox_center(mask: np.ndarray) -> tuple[float, float]:
    ys, xs = np.where(mask)
    if xs.size == 0:
        raise RuntimeError("Layer has no opaque pixels")
    return (float(xs.min() + xs.max()) / 2.0, float(ys.min() + ys.max()) / 2.0)


def mask_centroid(mask: np.ndarray) -> tuple[float, float]:
    ys, xs = np.where(mask)
    if xs.size == 0:
        raise RuntimeError("Layer has no opaque pixels")
    return (float(xs.mean()), float(ys.mean()))


def mask_from_image(im: Image.Image, alpha_min: int = 20) -> np.ndarray:
    return np.array(im)[..., 3] > alpha_min


def median_check_rgb(arr: np.ndarray, check_body: np.ndarray) -> tuple[float, float, float]:
    if not np.any(check_body):
        return CHECK_RGB
    pixels = arr[check_body, :3]
    return tuple(float(np.median(pixels[:, idx])) for idx in range(3))


def enlarge_check_layer(
    check_body_im: Image.Image,
    check_rgb: tuple[float, float, float],
    links_center: tuple[float, float],
) -> Image.Image:
    bbox = check_body_im.getbbox()
    if not bbox:
        raise RuntimeError("Checkmark layer is empty")
    x0, y0, x1, y1 = bbox
    body_crop = check_body_im.crop(bbox)
    alpha = body_crop.split()[3]
    cw, ch = body_crop.size
    nw = max(1, int(round(cw * CHECK_SCALE)))
    nh = max(1, int(round(ch * CHECK_SCALE)))
    scaled_alpha = alpha.resize((nw, nh), Image.Resampling.LANCZOS)
    scaled_body = Image.new("RGBA", (nw, nh), (*map(int, map(round, check_rgb)), 0))
    scaled_body.putalpha(scaled_alpha)

    paste_x = x0
    paste_y = y1 - nh + 1

    w, h = check_body_im.size
    placed = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    placed.paste(scaled_body, (paste_x, paste_y), scaled_body)

    body_placed = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    body_placed.paste(scaled_body, (paste_x, paste_y), scaled_body)
    cx, cy = mask_centroid(mask_from_image(body_placed))
    lx, ly = links_center
    shift_x = int(round(lx - cx + CHECK_OFFSET_X))
    shift_y = int(round(ly - cy + CHECK_OFFSET_Y))

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
    check_body, check, rings, weave = split_layers(arr, fg)

    out = arr.copy()
    out[~fg, 3] = 0
    out = lighten_rings(out, rings)

    links_arr = np.zeros_like(out)
    links_arr[rings] = out[rings]
    links_arr[weave] = out[weave]

    check_body_arr = np.zeros_like(out)
    check_body_arr[check_body] = out[check_body]

    links_im = Image.fromarray(np.clip(links_arr, 0, 255).astype(np.uint8), "RGBA")
    check_body_im = Image.fromarray(np.clip(check_body_arr, 0, 255).astype(np.uint8), "RGBA")
    check_rgb = median_check_rgb(out, check_body)
    links_center = mask_centroid(rings | weave)

    enlarged_check = enlarge_check_layer(check_body_im, check_rgb, links_center)
    composed = Image.alpha_composite(links_im, enlarged_check)
    result = compose_canvas(composed)
    result.save(OUT, optimize=True)
    print(f"Wrote {OUT} ({result.size[0]}x{result.size[1]}) from {SRC.name}")


if __name__ == "__main__":
    main()
