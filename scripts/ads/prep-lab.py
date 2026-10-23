"""Prepare the Hero League, Cauldron Lane and Masquerade Court trailer art.

usage: ~/.cache/adenv/bin/python prep-lab.py OUT_DIR [hx|cl|mq ...]
Cuts the full-body characters and props out of the 2x2 sheets in scripts/ads/heroes, scripts/ads/cauldron and
scripts/ads/masquerade (trimmed, transparent), and copies each game's card art and covers:
OUT_DIR/hx/<name>.png, OUT_DIR/cl/<name>.png and OUT_DIR/mq/<name>.png. Name games to prepare only those.
"""
import sys, pathlib
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

HERE = pathlib.Path(__file__).resolve().parent
IMG = HERE.parents[1] / 'img'
OUT = pathlib.Path(sys.argv[1])
session = new_session('isnet-general-use')

GAMES = {'hx': 'heroes', 'cl': 'cauldron', 'mq': 'masquerade'}
SHEETS = {
    'hx': {
        'heroes-a': ['valora', 'starbolt', 'mirra', 'firewall'],
        'heroes-b': ['kaos', 'crusher', 'nightshade', 'blur'],
        'heroes-c': ['ironclad', 'scout', 'sable', 'mecha'],
        'props': ['saucer', 'fountain', 'tower', 'searchlight'],
    },
    'cl': {
        'folk': ['knight', 'farmer', 'noble', 'wizard'],
        'beasts': ['griffin', 'dragon', 'unicorn', 'phoenix'],
        'shops': ['shop-red', 'shop-blue', 'shop-green', 'shop-purple'],
        'props': ['cauldron', 'stall', 'lantern', 'trophy'],
    },
    'mq': {
        'nobles-a': ['doge', 'duchess', 'jester', 'poisoner'],
        'nobles-b': ['doctor', 'gondolier', 'spy', 'dancer'],
        'props': ['gondola', 'lamp', 'pole', 'maskstand'],
        'buildings': ['palazzo-pink', 'palazzo-gold', 'campanile', 'palace'],
    },
}


def quads(im):
    w, h = im.size
    return [im.crop((x, y, x + w // 2, y + h // 2)) for y in (0, h // 2) for x in (0, w // 2)]


def cut(im, path):
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
    c.save(path)
    print(path.name, c.size, flush=True)


for short in sys.argv[2:] or GAMES:
    game = GAMES[short]
    out = OUT / short
    out.mkdir(parents=True, exist_ok=True)
    for sheet, names in SHEETS[short].items():
        for im, name in zip(quads(Image.open(HERE / game / f'{sheet}.jpg')), names):
            cut(im, out / f'full-{name}.png')
    for f in (IMG / game).glob('*.webp'):
        Image.open(f).convert('RGB').save(out / f'{f.stem}.png')
print('done')
