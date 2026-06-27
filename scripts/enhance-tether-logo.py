#!/usr/bin/env python3
"""Crop Tether logo tight, boost the light-blue check link, and center on 512² canvas."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "img" / "tether-logo.png"
OUT = SRC


def rgba_array(im: Image.Image) -> np.ndarray:
    return np.array(im.convert("RGBA"), dtype=np.float32)


def save_rgba(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA").save(path, optimize=True)


def chain_mask(arr: np.ndarray) -> np.ndarray:
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    sat = np.maximum.reduce(
        [
            np.abs(r - g),
            np.abs(g - b),
            np.abs(r - b),
        ]
    )
    return (a > 40) & (sat > 25) & ((r + g + b) > 80)


def light_link_mask(arr: np.ndarray, chain: np.ndarray) -> np.ndarray:
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    return chain & (b > 125) & (g > 85) & (b > r + 25)


def bbox(mask: np.ndarray, pad: int = 0) -> tuple[int, int, int, int]:
    ys, xs = np.where(mask)
    if xs.size == 0:
        raise RuntimeError("No opaque pixels found in logo")
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    h, w = mask.shape
    return (
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(w - 1, x1 + pad),
        min(h - 1, y1 + pad),
    )


def clean_edge_noise(arr: np.ndarray, chain: np.ndarray) -> np.ndarray:
    out = arr.copy()
    r, g, b, a = out[..., 0], out[..., 1], out[..., 2], out[..., 3]
    gray_edge = (a > 20) & (~chain) & ((r + g + b) < 420)
    out[gray_edge, 3] = 0
    return out


def boost_check_link(arr: np.ndarray, light: np.ndarray) -> np.ndarray:
    out = arr.copy()
    # Thicken the light link slightly so the check reads at small sizes.
    light_u8 = Image.fromarray(light.astype(np.uint8) * 255, "L")
    thickened = np.array(light_u8.filter(ImageFilter.MaxFilter(5))) > 127

    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    target = light | thickened
    # Brighter, more cyan check link.
    r[target] = np.clip(r[target] * 0.72, 0, 255)
    g[target] = np.clip(g[target] * 1.18, 0, 255)
    b[target] = np.clip(b[target] * 1.32, 0, 255)
    out[..., 0], out[..., 1], out[..., 2] = r, g, b
    return out


def compose_canvas(arr: np.ndarray, chain: np.ndarray, canvas: int = 512, fill: float = 0.94) -> Image.Image:
    x0, y0, x1, y1 = bbox(chain, pad=8)
    crop = Image.fromarray(np.clip(arr[y0 : y1 + 1, x0 : x1 + 1], 0, 255).astype(np.uint8), "RGBA")
    cw, ch = crop.size
    target = int(canvas * fill)
    scale = target / max(cw, ch)
    nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas_im = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    canvas_im.paste(resized, ((canvas - nw) // 2, (canvas - nh) // 2), resized)
    return canvas_im


def main() -> None:
    im = Image.open(SRC)
    arr = rgba_array(im)
    chain = chain_mask(arr)
    arr = clean_edge_noise(arr, chain)
    chain = chain_mask(arr)
    light = light_link_mask(arr, chain)
    arr = boost_check_link(arr, light)
    chain = chain_mask(arr)
    out = compose_canvas(arr, chain)
    out.save(OUT, optimize=True)
    print(f"Wrote {OUT} ({out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    main()
