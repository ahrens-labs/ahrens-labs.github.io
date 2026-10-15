"""Prepare the Hero League and Cauldron Lane trailer art.

usage: ~/.cache/adenv/bin/python prep-lab.py OUT_DIR
Writes OUT_DIR/hx/<name>.png (cover, every card, the missions, and the plaza/night/lair backgrounds from
scripts/ads/heroes) and OUT_DIR/cl/<name>.png (cover, beasts, townsfolk, and the market/shop/wild/fair
backgrounds from scripts/ads/cauldron).
"""
import sys, pathlib
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
IMG = HERE.parents[1] / 'img'
OUT = pathlib.Path(sys.argv[1])

for game, short in (('heroes', 'hx'), ('cauldron', 'cl')):
    out = OUT / short
    out.mkdir(parents=True, exist_ok=True)
    for f in (IMG / game).glob('*.webp'):
        Image.open(f).convert('RGBA' if game == 'cauldron' and f.stem != 'cover' else 'RGB').save(out / f'{f.stem}.png')
    for f in (HERE / game).glob('*.jpg'):
        Image.open(f).convert('RGB').resize((1600, 900), Image.LANCZOS).save(out / f'{f.stem}.png')
    print(short, len(list(out.glob('*.png'))), 'images')
