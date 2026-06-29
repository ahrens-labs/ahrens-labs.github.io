#!/usr/bin/env python3
"""Build Link logo: chain template + green gradient + person icon."""
from __future__ import annotations

import base64
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
CRM = ROOT / "workers" / "link-crm"
CHAIN_TEMPLATE = IMG / "link-chain-template.png"
PERSON_TEMPLATE = IMG / "tether-logo-template.png"
OUT_PNG = CRM / "link_logo.png"
CANVAS = 512
FILL = 0.92
ASSET_VERSION = "14"

CHECK_REF = np.array([20, 49, 93], dtype=np.float32)
CHAIN_REF = np.array([98, 192, 232], dtype=np.float32)

# Optical center correction within the chain opening (left, up) as bbox fractions.
PERSON_NUDGE = (-0.035, -0.055)

PERSON_COLOR = "#14532d"
CHAIN_HIGHLIGHT = np.array([178, 238, 196], dtype=np.float32)
CHAIN_MID = np.array([88, 198, 132], dtype=np.float32)
CHAIN_DARK = np.array([56, 168, 104], dtype=np.float32)
CHAIN_DEEP = np.array([40, 142, 88], dtype=np.float32)


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
    cx = (x0 + x1) / 2 + bw * PERSON_NUDGE[0]

    head_r = bw * 0.172
    head_cy = y0 + bh * 0.265 + bh * PERSON_NUDGE[1]
    neck_gap = head_r * 0.20
    shoulder_top = head_cy + head_r + neck_gap
    shoulder_y = shoulder_top + bh * 0.035
    body_bottom = y1 - bh * 0.012
    shoulder_half = bw * 0.304
    neck_half = head_r * 0.30

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


PWA_ICON_SIZES: list[tuple[int, float, str]] = [
    (48, FAVICON_FILL, "link_favicon-48.png"),
    (180, PWA_ANY_FILL, "link_icon-180.png"),
    (192, PWA_ANY_FILL, "link_icon-192.png"),
    (512, PWA_ANY_FILL, "link_icon-512.png"),
    (192, PWA_MASKABLE_FILL, "link_icon-192-maskable.png"),
    (512, PWA_MASKABLE_FILL, "link_icon-512-maskable.png"),
]


def write_pwa_icons(logo: Image.Image) -> None:
    exports: list[str] = []
    for size, fill, name in PWA_ICON_SIZES:
        out = fit_square(logo, size, fill)
        path = CRM / name
        out.save(path, optimize=True)
        var = name.replace("-", "_").replace(".png", "").upper()
        if name == "link_favicon-48.png":
            var = "FAVICON_48"
        elif name == "link_icon-180.png":
            var = "ICON_180"
        elif name == "link_icon-192.png":
            var = "ICON_192"
        elif name == "link_icon-512.png":
            var = "ICON_512"
        elif name == "link_icon-192-maskable.png":
            var = "ICON_192_MASKABLE"
        elif name == "link_icon-512-maskable.png":
            var = "ICON_512_MASKABLE"
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        exports.append(f"export const {var}_BASE64 = `{b64}`;")
        print(f"Wrote {path}")

    (CRM / "src" / "favicon.ts").write_text("\n\n".join(exports) + "\n", encoding="utf-8")
    print("Updated workers/link-crm/src/favicon.ts")


def main() -> None:
    im = compose()
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=115, threshold=3))
    result = fit_canvas(im, CANVAS, FILL)
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUT_PNG, optimize=True)
    print(f"Wrote {OUT_PNG} ({result.size[0]}x{result.size[1]})")
    write_pwa_icons(result)


if __name__ == "__main__":
    main()
