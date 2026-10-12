"""Cut the game's character and building art out of its painted backgrounds, for the ad videos.

usage: ~/.cache/adenv/bin/python cutout.py OUT_DIR [model]
Writes OUT_DIR/{dino,oak}/<name>.png (trimmed, transparent). Icons that already have alpha are copied as-is.
"""
import sys, pathlib
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parents[2] / 'img'
out = pathlib.Path(sys.argv[1])
session = new_session(sys.argv[2] if len(sys.argv) > 2 else 'isnet-general-use')
only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None

for game, src in (('dino', 'dino-game'), ('oak', 'hearthhold')):
    (out / game).mkdir(parents=True, exist_ok=True)
    for f in sorted((ROOT / src).glob('*.webp')):
        if only and f.stem not in only:
            continue
        im = Image.open(f)
        if f.stem == 'cover':
            im.convert('RGB').save(out / game / 'cover.png')
            continue
        if im.mode == 'RGBA':
            cut = im
        else:
            cut = remove(im.convert('RGB'), session=session, post_process_mask=True)
            # Drop stray bits of the painted background (a moon, a cloud) that aren't joined to the subject.
            a = np.array(cut.getchannel('A'))
            lab, n = ndimage.label(a > 24)
            if n > 1:
                sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
                keep = np.isin(lab, 1 + np.flatnonzero(sizes >= 0.04 * sizes.max()))
                keep = ndimage.binary_dilation(keep, iterations=2)
                cut.putalpha(Image.fromarray(np.where(keep, a, 0).astype(np.uint8)))
        box = cut.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if box:
            cut = cut.crop(box)
        cut.save(out / game / f'{f.stem}.png')
        print(game, f.stem, cut.size, flush=True)
