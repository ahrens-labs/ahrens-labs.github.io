"""Prepare the Atlantis Expedition trailer art from scripts/ads/atlantis.

usage: ~/.cache/adenv/bin/python cutout-atlantis.py OUT_DIR
Writes OUT_DIR/atl/<name>.png: the four subs and the swimmer and shark cut out (trimmed, transparent),
the four depth scenes cropped from their sheet, and the full-frame backgrounds as they are.
"""
import sys, pathlib
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / 'atlantis'
ROOT = HERE.parents[1] / 'img' / 'atlantis'
out = pathlib.Path(sys.argv[1]) / 'atl'
out.mkdir(parents=True, exist_ok=True)
session = new_session('isnet-general-use')


def quads(im):
    w, h = im.size
    return [im.crop((x, y, x + w // 2, y + h // 2)) for y in (0, h // 2) for x in (0, w // 2)]


def cut(im, name):
    c = remove(im.convert('RGB'), session=session, post_process_mask=True)
    # Keep only the subject: the biggest blob and anything sizeable joined to it.
    a = np.array(c.getchannel('A'))
    lab, n = ndimage.label(a > 24)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        keep = np.isin(lab, 1 + np.flatnonzero(sizes >= 0.04 * sizes.max()))
        keep = ndimage.binary_dilation(keep, iterations=2)
        c.putalpha(Image.fromarray(np.where(keep, a, 0).astype(np.uint8)))
    box = c.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        c = c.crop(box)
    c.save(out / f'{name}.png')
    print(name, c.size, flush=True)


for im, k in zip(quads(Image.open(SRC / 'atlantis-subs.jpg')), ['minnow', 'barracuda', 'nautilus', 'leviathan']):
    # Trim the sheet's frame lines before cutting out.
    w, h = im.size
    cut(im.crop((12, 12, w - 12, h - 12)), f'sub-{k}')
for im, k in zip(quads(Image.open(SRC / 'atlantis-depths.jpg')), ['depth-1', 'depth-2', 'depth-3', 'depth-heart']):
    w, h = im.size
    im.crop((4, 4, w - 4, h - 4)).convert('RGB').save(out / f'{k}.png')
for k in ('swimmer', 'shark'):
    cut(Image.open(SRC / f'{k}.jpg'), k)
for k in ('surface', 'kraken', 'heart', 'reef'):
    Image.open(SRC / f'{k}.jpg').convert('RGB').save(out / f'{k}.png')
Image.open(ROOT / 'cover.webp').convert('RGB').save(out / 'cover.png')
for f in sorted(ROOT.glob('diver-*.webp')):
    Image.open(f).convert('RGB').save(out / f'{f.stem}.png')
print('done')
