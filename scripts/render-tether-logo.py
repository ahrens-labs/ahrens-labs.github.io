#!/usr/bin/env python3
"""Enhance the Tether logo template: transparent bg, richer chains, crisp check."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
TEMPLATE = IMG / "tether-logo-template.png"
OUT_PNG = IMG / "tether-logo.png"
OUT_SVG = IMG / "tether-logo.svg"
CANVAS = 512
FILL = 0.92
ASSET_VERSION = "30"

CHECK = np.array([20, 49, 93], dtype=np.float32)
# Medium blue chain palette — lighter than prior pass, still gradient-friendly
CHAIN_HIGHLIGHT = np.array([158, 214, 240], dtype=np.float32)
CHAIN_MID = np.array([88, 168, 214], dtype=np.float32)
CHAIN_DARK = np.array([54, 138, 194], dtype=np.float32)
CHAIN_DEEP = np.array([36, 118, 176], dtype=np.float32)


def load_template() -> np.ndarray:
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Missing template: {TEMPLATE}")
    return np.array(Image.open(TEMPLATE).convert("RGBA"), dtype=np.float32)


def is_background(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    bright = (r + g + b) / 3.0
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    return (bright > 246) | ((bright > 235) & (sat < 18))


def layer_masks(r: np.ndarray, g: np.ndarray, b: np.ndarray, bg: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    fg = ~bg
    rgb = np.stack([r, g, b], axis=-1)
    d_check = np.sum((rgb - CHECK) ** 2, axis=-1)
    d_chain = np.sum((rgb - CHAIN_MID) ** 2, axis=-1)
    check = fg & (d_check <= d_chain)
    chain = fg & ~check
    return check, chain


def shade_chains(r: np.ndarray, g: np.ndarray, b: np.ndarray, chain: np.ndarray) -> np.ndarray:
    out = np.zeros((*r.shape, 3), dtype=np.float32)
    if not np.any(chain):
        return out

    h, w = r.shape
    ys = np.where(chain)[0]
    xs = np.where(chain)[1]
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()
    y_span = max(y1 - y0, 1)
    x_span = max(x1 - x0, 1)

    yy = np.arange(h, dtype=np.float32)[:, None]
    xx = np.arange(w, dtype=np.float32)[None, :]

    # Vertical: lighter crest, darker underside
    v = np.clip((yy - y0) / y_span, 0, 1)
    vertical = 1.0 - v
    vertical = vertical**1.35

    # Horizontal: gentle shift between the two links
    hpos = np.clip((xx - x0) / x_span, 0, 1)
    horizontal = 0.88 + 0.12 * np.sin(hpos * np.pi)

    # Radial depth under the checkmark
    cy = (y0 + y1) / 2.0
    cx = (x0 + x1) / 2.0 + x_span * 0.04
    dist = np.sqrt(((yy - cy) / (y_span * 0.55)) ** 2 + ((xx - cx) / (x_span * 0.42)) ** 2)
    radial = np.clip(1.0 - dist * 0.55, 0, 1) ** 1.2

    # Top-left sheen
    sheen = np.clip(1.0 - ((yy - y0) / y_span) * 0.65 - ((xx - x0) / x_span) * 0.25, 0, 1)

    mix = np.clip(vertical * 0.45 + radial * 0.35 + sheen * 0.2, 0, 1)
    base = CHAIN_DEEP * (1.0 - mix[..., None]) + CHAIN_DARK * mix[..., None] * 0.55 + CHAIN_MID * mix[..., None] * 0.45
    base = base * horizontal[..., None]

    lum = (r + g + b) / 3.0
    edge = np.clip((lum - 95) / 85.0, 0, 1)
    highlight = CHAIN_HIGHLIGHT * (edge * vertical * 0.55)[..., None]

    rgb = np.clip(base + highlight, 0, 255)
    for c in range(3):
        out[..., c] = np.where(chain, rgb[..., c], out[..., c])
    return out


def enhance(arr: np.ndarray) -> np.ndarray:
    r, g, b, _a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    bg = is_background(r, g, b)
    check, chain = layer_masks(r, g, b, bg)
    chain_rgb = shade_chains(r, g, b, chain)

    out = np.zeros_like(arr)
    out[..., 3] = np.where(bg, 0, 255)
    out[check, 0] = CHECK[0]
    out[check, 1] = CHECK[1]
    out[check, 2] = CHECK[2]
    for c in range(3):
        out[chain, c] = chain_rgb[chain, c]

    return np.clip(out, 0, 255).astype(np.uint8)


def fit_canvas(im: Image.Image, canvas: int, fill: float) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        raise RuntimeError("Template produced empty image")
    cropped = im.crop(bbox)
    target = int(canvas * fill)
    scale = target / max(cropped.size)
    nw = max(1, int(round(cropped.size[0] * scale)))
    nh = max(1, int(round(cropped.size[1] * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(resized, ((canvas - nw) // 2, (canvas - nh) // 2), resized)
    return out


def main() -> None:
    raw = enhance(load_template())
    im = Image.fromarray(raw, "RGBA")
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=115, threshold=3))
    result = fit_canvas(im, CANVAS, FILL)
    result.save(OUT_PNG, optimize=True)
    OUT_SVG.write_text(
        f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS} {CANVAS}" fill="none">
  <image width="{CANVAS}" height="{CANVAS}" href="tether-logo.png?v={ASSET_VERSION}"/>
</svg>
''',
        encoding="utf-8",
    )
    print(f"Enhanced {TEMPLATE.name} -> {OUT_PNG} ({result.size[0]}x{result.size[1]})")


if __name__ == "__main__":
    main()
