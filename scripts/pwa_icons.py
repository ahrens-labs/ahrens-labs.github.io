"""Shared helpers for PWA / mobile home-screen icon sizing."""
from __future__ import annotations

from PIL import Image

# Leave room for iOS rounded corners and Android adaptive-icon masks.
PWA_ANY_FILL = 0.86
PWA_MASKABLE_FILL = 0.74
FAVICON_FILL = 0.92


def fit_square(im: Image.Image, size: int, fill: float = PWA_ANY_FILL) -> Image.Image:
    """Center artwork on a square canvas; longest side scales to size * fill."""
    rgba = im.convert("RGBA")
    bbox = rgba.getbbox()
    if not bbox:
        raise RuntimeError("Empty image")
    cropped = rgba.crop(bbox)
    target = max(1, int(round(size * fill)))
    scale = target / max(cropped.size)
    nw = max(1, int(round(cropped.size[0] * scale)))
    nh = max(1, int(round(cropped.size[1] * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return out
