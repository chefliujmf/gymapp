#!/usr/bin/env python3
# Downscale + progressive-encode the served images. Full-res originals stay in
# downloaded_pages/ (and on Drive as backup); only the XPS-served copies shrink.
# 3198x1800 ~5MB baseline JPEG  ->  <=1080px wide, q82, progressive  ~60-120KB.
import os, sys
from PIL import Image

SRC = 'downloaded_pages'
OUT = 'media-opt/images'
MAXW = 1080
FOLDERS = {
    'recipes_images':  lambda f: f.lower().endswith(('.jpg', '.jpeg', '.png')),
    'snacks_images':   lambda f: f.lower().endswith(('.jpg', '.jpeg', '.png')),
    'workouts_images': lambda f: f.lower().endswith(('.jpg', '.jpeg', '.png')),
    'centr_images':    lambda f: f.lower().endswith(('.jpg', '.jpeg', '.png')),
    'mw_media':        lambda f: f.startswith('og-') and f.lower().endswith('.jpg'),  # exercise posters only (not videos)
}

total = done = 0
for d, keep in FOLDERS.items():
    src = os.path.join(SRC, d)
    if not os.path.isdir(src):
        continue
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
    files = [f for f in os.listdir(src) if keep(f)]
    total += len(files)
    for f in files:
        try:
            im = Image.open(os.path.join(src, f)).convert('RGB')
            if im.width > MAXW:
                im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
            im.save(os.path.join(OUT, d, f), 'JPEG', quality=82, optimize=True, progressive=True)
            done += 1
            if done % 500 == 0:
                print(f'  {done}/{total}…', flush=True)
        except Exception as e:
            print('skip', d + '/' + f, e, file=sys.stderr)
    print(f'{d}: {len(files)} images', flush=True)
print(f'DONE: optimized {done}/{total} -> {OUT}')
