#!/usr/bin/env python3
"""Prepare Tether logo: split links/checkmark, center check above links, export 512² PNG."""
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


def rgba_array(im: Image.Image) -> np.ndarray:
    return np.array(im.convert("RGBA"), dtype=np.float32)


def background_mask(arr: np.ndarray) -> np.ndarray:
    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    bright = (r + g + b) / 3
    return (sat < 28) & (bright > 150) & (bright < 250)


def split_layers(arr: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    fg = ~background_mask(arr)
    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    sat = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    bright = (r + g + b) / 3

    check = fg & (b > 100) & (g > 90) & (r < 110) & (sat > 18) & (bright > 75) & (bright < 215)
    check_u8 = Image.fromarray((check.astype(np.uint8) * 255))
    check_dilated = np.array(check_u8.filter(ImageFilter.MaxFilter(7))) > 127
    shadow = fg & check_dilated & ~check & (bright > 60) & (bright < 140) & (b > 60)
    check_all = check | shadow

    navy = fg & (bright < 130) & (b > 25) & (sat > 8) & ~check_all
    white = fg & (bright > 200) & (sat < 25)
    links = navy | white

    return check, check_all, links


def boost_check(arr: np.ndarray, check: np.ndarray) -> np.ndarray:
    out = arr.copy()
    out[check, 0] = np.clip(out[check, 0] * 0.82, 0, 255)
    out[check, 1] = np.clip(out[check, 1] * 1.15, 0, 255)
    out[check, 2] = np.clip(out[check, 2] * 1.22, 0, 255)
    return out


def build_links_layer(arr: np.ndarray, check_all: np.ndarray, links: np.ndarray) -> Image.Image:
    links_arr = np.zeros_like(arr)
    links_arr[links] = arr[links]
    navy_color = np.median(arr[links, :3], axis=0) if links.any() else np.array([22.0, 45.0, 82.0])
    links_under = (
        np.array(Image.fromarray((links.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(15))) > 127
    )
    fill = check_all & links_under
    links_arr[fill, 0] = navy_color[0]
    links_arr[fill, 1] = navy_color[1]
    links_arr[fill, 2] = navy_color[2]
    links_arr[fill, 3] = 255
    return Image.fromarray(np.clip(links_arr, 0, 255).astype(np.uint8), "RGBA")


def build_check_layer(arr: np.ndarray, check: np.ndarray, check_all: np.ndarray) -> Image.Image:
    check_arr = np.zeros_like(arr)
    check_arr[check_all] = arr[check_all]
    check_arr = boost_check(check_arr, check)
    return Image.fromarray(np.clip(check_arr, 0, 255).astype(np.uint8), "RGBA")


def layer_centroid(im: Image.Image) -> tuple[float, float]:
    alpha = np.array(im)[..., 3]
    ys, xs = np.where(alpha > 20)
    if xs.size == 0:
        raise RuntimeError("Layer has no opaque pixels")
    return float(xs.mean()), float(ys.mean())


def composite_centered(links_im: Image.Image, check_im: Image.Image) -> Image.Image:
    w, h = links_im.size
    base = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    base.paste(links_im, (0, 0), links_im)

    lx, ly = layer_centroid(links_im)
    cx, cy = layer_centroid(check_im)
    dx, dy = int(round(lx - cx)), int(round(ly - cy))

    shifted = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shifted.paste(check_im, (dx, dy), check_im)
    return Image.alpha_composite(base, shifted)


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
    check, check_all, links = split_layers(arr)
    links_im = build_links_layer(arr, check_all, links)
    check_im = build_check_layer(arr, check, check_all)
    composed = composite_centered(links_im, check_im)
    result = compose_canvas(composed)
    result.save(OUT, optimize=True)
    print(f"Wrote {OUT} ({result.size[0]}x{result.size[1]}) from {SRC.name}")


if __name__ == "__main__":
    main()
