#!/usr/bin/env python3
"""Build Link logo: chain template + green gradient + person icon."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
CRM = ROOT / "workers" / "link-crm"
CHAIN_TEMPLATE = IMG / "link-chain-template.png"
PERSON_TEMPLATE = IMG / "tether-logo-template.png"
OUT_PNG = CRM / "link_logo.png"
CANVAS = 512
FILL = 0.92
ASSET_VERSION = "5"

CHECK_REF = np.array([20, 49, 93], dtype=np.float32)
CHAIN_REF = np.array([98, 192, 232], dtype=np.float32)

PERSON_COLOR = "#14532d"
CHAIN_HIGHLIGHT = np.array([146, 228, 168], dtype=np.float32)
CHAIN_MID = np.array([48, 168, 96], dtype=np.float32)
CHAIN_DARK = np.array([24, 132, 72], dtype=np.float32)
CHAIN_DEEP = np.array([16, 104, 58], dtype=np.float32)


def is_background(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    bright = (r + g + b) / 3.0
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    return (bright > 246) | ((bright > 235) & (sat < 18))


def chain_mask_from_template(arr: np.ndarray) -> np.ndarray:
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    bg = is_background(r, g, b) | (a < 128)
    return ~bg


def person_bbox_from_tether() -> tuple[int, int, int, int]:
    arr = np.array(Image.open(PERSON_TEMPLATE).convert("RGBA"), dtype=np.float32)
    r, g, b, _a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    bg = is_background(r, g, b)
    rgb = np.stack([r, g, b], axis=-1)
    d_check = np.sum((rgb - CHECK_REF) ** 2, axis=-1)
    d_chain = np.sum((rgb - CHAIN_REF) ** 2, axis=-1)
    check = (~bg) & (d_check <= d_chain)
    ys, xs = np.where(check)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


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

    v = np.clip((yy - y0) / y_span, 0, 1)
    vertical = (1.0 - v) ** 1.35

    hpos = np.clip((xx - x0) / x_span, 0, 1)
    horizontal = 0.88 + 0.12 * np.sin(hpos * np.pi)

    cy = (y0 + y1) / 2.0
    cx = (x0 + x1) / 2.0 + x_span * 0.04
    dist = np.sqrt(((yy - cy) / (y_span * 0.55)) ** 2 + ((xx - cx) / (x_span * 0.42)) ** 2)
    radial = np.clip(1.0 - dist * 0.55, 0, 1) ** 1.2

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


def render_chains(arr: np.ndarray) -> Image.Image:
    r, g, b, _a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    chain = chain_mask_from_template(arr)
    chain_rgb = shade_chains(r, g, b, chain)

    out = np.zeros_like(arr)
    out[..., 3] = np.where(chain, 255, 0)
    for c in range(3):
        out[chain, c] = chain_rgb[chain, c]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def render_person(w: int, h: int, bbox: tuple[int, int, int, int]) -> Image.Image:
    x0, y0, x1, y1 = bbox
    bw = x1 - x0
    bh = y1 - y0
    cx = (x0 + x1) / 2
    head_cy = y0 + bh * 0.27
    head_r = bw * 0.155
    # Shoulders meet the head with a short neck (minimal gap).
    shoulder_top = head_cy + head_r * 0.88
    shoulder_y = shoulder_top + bh * 0.06
    body_bottom = y1 - bh * 0.04
    shoulder_half = bw * 0.34
    neck_half = head_r * 0.38

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <circle cx="{cx:.1f}" cy="{head_cy:.1f}" r="{head_r:.1f}" fill="{PERSON_COLOR}"/>
  <path fill="{PERSON_COLOR}" d="M {cx - shoulder_half:.1f} {body_bottom:.1f}
    C {cx - shoulder_half:.1f} {shoulder_y:.1f}, {cx - neck_half:.1f} {shoulder_top:.1f}, {cx:.1f} {shoulder_top:.1f}
    C {cx + neck_half:.1f} {shoulder_top:.1f}, {cx + shoulder_half:.1f} {shoulder_y:.1f}, {cx + shoulder_half:.1f} {body_bottom:.1f} Z"/>
</svg>'''
    return Image.open(BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=w, output_height=h))).convert("RGBA")


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


def compose() -> Image.Image:
    arr = np.array(Image.open(CHAIN_TEMPLATE).convert("RGBA"), dtype=np.float32)
    h, w = arr.shape[:2]
    bbox = person_bbox_from_tether()
    base = render_chains(arr)
    person = render_person(w, h, bbox)
    return Image.alpha_composite(base, person)


def main() -> None:
    im = compose()
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=115, threshold=3))
    result = fit_canvas(im, CANVAS, FILL)
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUT_PNG, optimize=True)
    print(f"Wrote {OUT_PNG} ({result.size[0]}x{result.size[1]})")


if __name__ == "__main__":
    main()
