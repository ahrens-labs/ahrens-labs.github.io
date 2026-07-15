#!/usr/bin/env python3
"""Build Platter logo: identical chain template + darker yellow + fork/plate medallion."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from pwa_icons import FAVICON_FILL, PWA_ANY_FILL, PWA_MASKABLE_FILL, fit_square  # noqa: E402

IMG = ROOT / "img"
CHAIN_TEMPLATE = IMG / "link-chain-template.png"
# User-supplied fork / plate / knife medallion (with its own chains — we crop the center only).
MEDALLION_SRC = IMG / "platter-medallion-source.png"
OUT_PNG = IMG / "platter-logo.png"
OUT_SOURCE = IMG / "platter-logo-source.png"
OUT_128 = IMG / "platter-logo-128.png"
OUT_SVG = IMG / "platter-logo.svg"
OUT_FAVICON_SVG = IMG / "platter-favicon.svg"
CANVAS = 512
FILL = 0.92
ASSET_VERSION = "10"

# Warm yellow / gold — same shading model as Tether/Link (a touch brighter).
CHAIN_HIGHLIGHT = np.array([240.0, 200.0, 55.0], dtype=np.float32)
CHAIN_MID = np.array([220.0, 170.0, 30.0], dtype=np.float32)
CHAIN_DARK = np.array([185.0, 135.0, 18.0], dtype=np.float32)
CHAIN_DEEP = np.array([145.0, 100.0, 12.0], dtype=np.float32)

FAVICON_SIZES: list[tuple[int, float, str]] = [
    (32, FAVICON_FILL, "platter-favicon-32.png"),
    (48, FAVICON_FILL, "platter-favicon-48.png"),
    (96, FAVICON_FILL, "platter-favicon-96.png"),
    (128, FAVICON_FILL, "platter-favicon-128.png"),
    (180, PWA_ANY_FILL, "platter-favicon-180.png"),
    (192, PWA_ANY_FILL, "platter-favicon-192.png"),
    (512, PWA_ANY_FILL, "platter-favicon-512.png"),
    (192, PWA_MASKABLE_FILL, "platter-favicon-192-maskable.png"),
    (512, PWA_MASKABLE_FILL, "platter-favicon-512-maskable.png"),
]


def is_background(r: np.ndarray, g: np.ndarray, b: np.ndarray, a: np.ndarray | None = None) -> np.ndarray:
    rf, gf, bf = r.astype(np.float32), g.astype(np.float32), b.astype(np.float32)
    bright = (rf + gf + bf) / 3.0
    sat = np.maximum.reduce([np.abs(rf - gf), np.abs(gf - bf), np.abs(rf - bf)])
    bg = (bright > 246) | ((bright > 235) & (sat < 18))
    if a is not None:
        bg = bg | (a < 128)
    return bg


def chain_mask_from_template(arr: np.ndarray) -> np.ndarray:
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    return ~is_background(r, g, b, a)


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

    lum = (r.astype(np.float32) + g.astype(np.float32) + b.astype(np.float32)) / 3.0
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


def extract_medallion(src: Path) -> Image.Image:
    """Circular crop of the fork/plate/knife emblem from the user artwork."""
    u = np.array(Image.open(src).convert("RGBA"), dtype=np.float32)
    h, w = u.shape[:2]
    ucx, ucy = w / 2.0, h / 2.0
    ua = u[..., 3]
    ur, ug, ub = u[..., 0], u[..., 1], u[..., 2]

    # White plate face near center defines the medallion.
    uwhite = (ua > 200) & (ur > 245) & (ug > 245) & (ub > 240)
    wy, wx = np.where(uwhite)
    wd = np.sqrt((wx.astype(float) - ucx) ** 2 + (wy.astype(float) - ucy) ** 2)
    keep_w = wd < min(w, h) * 0.35
    if not np.any(keep_w):
        raise RuntimeError("Could not find plate face in medallion source")
    wx, wy = wx[keep_w], wy[keep_w]
    # Outer rim sits just outside the white disc; expand for gold rim + slight pad.
    plate_r = float(np.percentile(np.sqrt((wx - ucx) ** 2 + (wy - ucy) ** 2), 98))
    med_r = plate_r * 1.22

    yy = np.arange(h, dtype=np.float32)[:, None]
    xx = np.arange(w, dtype=np.float32)[None, :]
    dist = np.sqrt((xx - ucx) ** 2 + (yy - ucy) ** 2)
    med_mask = dist <= med_r

    med = u.copy()
    med[~med_mask] = 0

    # Darken yellows on the rim / utensils to match chain palette.
    mr, mg, mb, ma = med[..., 0], med[..., 1], med[..., 2], med[..., 3]
    is_yellow = (
        (ma > 40)
        & (mr > 150)
        & (mg > 80)
        & (mr >= mb + 30)
        & ~((mr > 235) & (mg > 235) & (mb > 230))
    )
    mL = (0.2126 * mr + 0.7152 * mg + 0.0722 * mb) / 255.0
    mLn = np.clip((mL - 0.25) / 0.75, 0, 1)
    light_m = CHAIN_HIGHLIGHT
    dark_m = CHAIN_DEEP
    newc = dark_m + (light_m - dark_m) * mLn[..., None]
    med[is_yellow, :3] = newc[is_yellow]

    # Soft circular alpha edge
    soft = np.clip((med_r - dist) / 2.5, 0, 1)
    med[..., 3] = med[..., 3] * soft

    # Crop to bbox
    ys, xs = np.where(med[..., 3] > 8)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    return Image.fromarray(np.clip(med[y0:y1, x0:x1], 0, 255).astype(np.uint8), "RGBA")


def opening_center(arr: np.ndarray) -> tuple[float, float]:
    chain = chain_mask_from_template(arr)
    ys, xs = np.where(chain)
    return (xs.min() + xs.max()) / 2.0, (ys.min() + ys.max()) / 2.0


def medallion_target_size(arr: np.ndarray) -> int:
    """Plate over the chain join (~1.75× the original medallion)."""
    chain = chain_mask_from_template(arr)
    ys, xs = np.where(chain)
    chain_h = ys.max() - ys.min() + 1
    # Original was 0.72 * chain_h; 1.75× that ≈ 1.26.
    return int(round(chain_h * 1.26))


def place_medallion(base: Image.Image, med: Image.Image, cx: float, cy: float, size: int) -> Image.Image:
    med_r = med.resize((size, size), Image.Resampling.LANCZOS)
    out = base.copy()
    ox = int(round(cx - size / 2.0))
    oy = int(round(cy - size / 2.0))
    out.paste(med_r, (ox, oy), med_r)
    return out


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
    if not CHAIN_TEMPLATE.exists():
        raise FileNotFoundError(f"Missing chain template: {CHAIN_TEMPLATE}")
    if not MEDALLION_SRC.exists():
        raise FileNotFoundError(f"Missing medallion source: {MEDALLION_SRC}")

    arr = np.array(Image.open(CHAIN_TEMPLATE).convert("RGBA"), dtype=np.float32)
    base = render_chains(arr)
    med = extract_medallion(MEDALLION_SRC)
    cx, cy = opening_center(arr)
    size = medallion_target_size(arr)
    return place_medallion(base, med, cx, cy, size)


def write_svgs() -> None:
    OUT_SVG.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">\n'
        f'  <image width="512" height="512" href="platter-logo.png?v={ASSET_VERSION}"/>\n'
        f"</svg>\n",
        encoding="utf-8",
    )
    OUT_FAVICON_SVG.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">\n'
        f'  <image width="512" height="512" href="platter-favicon-512.png?v={ASSET_VERSION}"/>\n'
        f"</svg>\n",
        encoding="utf-8",
    )


def write_favicons(logo: Image.Image) -> None:
    for size, fill, name in FAVICON_SIZES:
        out = fit_square(logo, size, fill)
        path = IMG / name
        out.save(path, optimize=True)
        print(f"Wrote {path}")


def main() -> None:
    im = compose()
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=115, threshold=3))
    result = fit_canvas(im, CANVAS, FILL)
    result.save(OUT_SOURCE, optimize=True)
    result.save(OUT_PNG, optimize=True)
    result.resize((128, 128), Image.Resampling.LANCZOS).save(OUT_128, optimize=True)
    write_favicons(result)
    write_svgs()

    # Multi-size ICO
    from subprocess import run

    run(
        [
            "convert",
            str(IMG / "platter-favicon-32.png"),
            str(IMG / "platter-favicon-48.png"),
            str(IMG / "platter-favicon-96.png"),
            str(IMG / "platter-favicon-128.png"),
            str(IMG / "platter-favicon.ico"),
        ],
        check=True,
    )
    print(f"Wrote {OUT_PNG} ({result.size[0]}x{result.size[1]}) v={ASSET_VERSION}")


if __name__ == "__main__":
    main()
