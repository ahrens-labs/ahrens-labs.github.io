#!/usr/bin/env python3
"""Build Classify logo: chain template + red gradient + pencil icon."""
from __future__ import annotations

import sys
from io import BytesIO
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from pwa_icons import FAVICON_FILL, PWA_ANY_FILL, PWA_MASKABLE_FILL, fit_square  # noqa: E402

IMG = ROOT / "img"
TEMPLATE = IMG / "tether-logo-template.png"
OUT_PNG = IMG / "classify-logo.png"
OUT_TOPBAR = ROOT / "classify.png"
CANVAS = 512
FILL = 0.92
ASSET_VERSION = "3"

CHECK_REF = np.array([20, 49, 93], dtype=np.float32)
CHAIN_REF = np.array([98, 192, 232], dtype=np.float32)

CHAIN_HIGHLIGHT = np.array([255, 168, 158], dtype=np.float32)
CHAIN_MID = np.array([228, 72, 62], dtype=np.float32)
CHAIN_DARK = np.array([196, 48, 42], dtype=np.float32)
CHAIN_DEEP = np.array([158, 32, 28], dtype=np.float32)

PENCIL_BODY = "#dc2626"
PENCIL_TIP = "#7f1d1d"
PENCIL_ERASER = "#fecaca"
PENCIL_FERRULE = "#cbd5e1"


def is_background(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    bright = (r + g + b) / 3.0
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    return (bright > 246) | ((bright > 235) & (sat < 18))


def layer_masks(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    bg = is_background(r, g, b)
    fg = ~bg
    rgb = np.stack([r, g, b], axis=-1)
    d_check = np.sum((rgb - CHECK_REF) ** 2, axis=-1)
    d_chain = np.sum((rgb - CHAIN_REF) ** 2, axis=-1)
    check = fg & (d_check <= d_chain)
    chain = fg & ~check
    return check, chain


def icon_bbox(arr: np.ndarray) -> tuple[int, int, int, int]:
    check, _chain = layer_masks(arr[..., 0], arr[..., 1], arr[..., 2])
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

    mix = np.clip(vertical * 0.40 + radial * 0.32 + sheen * 0.18, 0.22, 1)
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
    _check, chain = layer_masks(r, g, b)
    chain_rgb = shade_chains(r, g, b, chain)

    out = np.zeros_like(arr)
    out[..., 3] = np.where(chain, 255, 0)
    for c in range(3):
        out[chain, c] = chain_rgb[chain, c]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def opening_center_from_chains(arr: np.ndarray) -> tuple[float, float]:
    _check, chain = layer_masks(arr[..., 0], arr[..., 1], arr[..., 2])
    ys, xs = np.where(chain)
    return (xs.min() + xs.max()) / 2.0, (ys.min() + ys.max()) / 2.0


def icon_target(bbox: tuple[int, int, int, int], arr: np.ndarray) -> tuple[float, float]:
    x0, y0, x1, y1 = bbox
    opening_cx, _opening_cy = opening_center_from_chains(arr)
    return opening_cx, (y0 + y1) / 2.0


def place_icon_centered(
    icon: Image.Image,
    target_cx: float,
    target_cy: float,
    clip: tuple[int, int, int, int],
) -> Image.Image:
    pb = icon.getbbox()
    if not pb:
        return icon
    pcx = (pb[0] + pb[2]) / 2
    pcy = (pb[1] + pb[3]) / 2
    dx = int(round(target_cx - pcx))
    dy = int(round(target_cy - pcy))

    x0, y0, x1, y1 = clip
    left, top, right, bottom = pb[0] + dx, pb[1] + dy, pb[2] + dx, pb[3] + dy
    if left < x0:
        dx += x0 - left
    if top < y0:
        dy += y0 - top
    if right > x1:
        dx -= right - x1
    if bottom > y1:
        dy -= bottom - y1

    out = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    out.paste(icon, (dx, dy), icon)
    return out


def render_pencil(
    w: int,
    h: int,
    bbox: tuple[int, int, int, int],
    target_cx: float,
    target_cy: float,
) -> Image.Image:
    x0, y0, x1, y1 = bbox
    bw = x1 - x0
    bh = y1 - y0
    length = min(bw, bh) * 0.86
    body_w = length * 0.16
    eraser_h = length * 0.14
    ferrule_h = length * 0.05
    tip_h = length * 0.16
    body_h = length - eraser_h - ferrule_h - tip_h
    half_w = body_w / 2

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <g transform="translate({target_cx:.1f} {target_cy:.1f}) rotate(-42)">
    <rect x="{-half_w:.1f}" y="{-length / 2 + eraser_h:.1f}" width="{body_w:.1f}" height="{body_h:.1f}" rx="{body_w * 0.08:.1f}" fill="{PENCIL_BODY}"/>
    <rect x="{-half_w:.1f}" y="{-length / 2 + eraser_h + body_h:.1f}" width="{body_w:.1f}" height="{ferrule_h:.1f}" fill="{PENCIL_FERRULE}"/>
    <rect x="{-half_w:.1f}" y="{-length / 2:.1f}" width="{body_w:.1f}" height="{eraser_h:.1f}" rx="{body_w * 0.12:.1f}" fill="{PENCIL_ERASER}"/>
    <polygon points="{-half_w:.1f},{length / 2 - tip_h:.1f} {half_w:.1f},{length / 2 - tip_h:.1f} 0,{length / 2:.1f}" fill="{PENCIL_TIP}"/>
  </g>
</svg>'''
    icon = Image.open(BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=w, output_height=h))).convert("RGBA")
    return place_icon_centered(icon, target_cx, target_cy, bbox)


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
    arr = np.array(Image.open(TEMPLATE).convert("RGBA"), dtype=np.float32)
    h, w = arr.shape[:2]
    bbox = icon_bbox(arr)
    target_cx, target_cy = icon_target(bbox, arr)
    base = render_chains(arr)
    pencil = render_pencil(w, h, bbox, target_cx, target_cy)
    return Image.alpha_composite(base, pencil)


FAVICON_SIZES: list[tuple[int, float, str]] = [
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


def write_favicons(logo: Image.Image) -> None:
    ico_parts: list[Image.Image] = []
    for size, fill, name in FAVICON_SIZES:
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

    section = fit_square(logo, 128, PWA_ANY_FILL)
    section.save(IMG / "classify-logo-128.png", optimize=True)
    print("wrote img/classify-logo-128.png")


def main() -> None:
    im = compose()
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=115, threshold=3))
    result = fit_canvas(im, CANVAS, FILL)
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUT_PNG, optimize=True)
    result.save(OUT_TOPBAR, optimize=True)
    print(f"Wrote {OUT_PNG} ({result.size[0]}x{result.size[1]})")
    print(f"Wrote {OUT_TOPBAR}")
    write_favicons(result)


if __name__ == "__main__":
    main()
