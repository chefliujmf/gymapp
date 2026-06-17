#!/usr/bin/env python3
"""Download MuscleWiki demo media (male + female videos + posters) for the
exercises we merged into the library, so we can self-host on Drive instead of
hotlinking. MuscleWiki is behind Cloudflare, so we use curl_cffi to impersonate
Chrome's TLS fingerprint (plain curl/requests get 403). Resumable; output is
gitignored (downloaded_pages/). Same downstream pipeline as the Centr videos:
rsync -> XPS -> rclone to Drive, then remap the catalog.
"""
import os
import json
import time
from urllib.parse import urlparse
from curl_cffi import requests as creq

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MW = os.path.join(ROOT, "downloaded_pages", "musclewiki.json")
CATALOG = os.path.join(ROOT, "src", "data", "generated", "exercises.json")
OUT = os.path.join(ROOT, "downloaded_pages", "mw_media")
os.makedirs(OUT, exist_ok=True)

DELAY = 0.15
RETRIES = 4
HEADERS = {"Referer": "https://musclewiki.com/"}

# Which MuscleWiki exercises did we actually keep? (source=musclewiki in catalog)
kept_slugs = {e["id"][3:] for e in json.load(open(CATALOG)) if e.get("source") == "musclewiki"}
mw = json.load(open(MW))

urls = {}  # filename -> url
for e in mw:
    if e.get("slug") not in kept_slugs:
        continue
    # Only the FRONT view per gender (what the app shows) — first male + first female.
    first_male = (e.get("male_images") or [None])[0]
    first_female = (e.get("female_images") or [None])[0]
    for imgs in (first_male, first_female):
        if not imgs:
            continue
        for key in ("branded_video", "og_image"):
            u = imgs.get(key)
            if u:
                urls[os.path.basename(urlparse(u).path)] = u
print(f"{len(kept_slugs)} kept exercises -> {len(urls)} media files to fetch (front view, both genders)")


def ok_file(path, is_video):
    if not (os.path.exists(path) and os.path.getsize(path) > 2000):
        return False
    if not is_video:
        return True
    with open(path, "rb") as f:
        return b"ftyp" in f.read(16)


def download(url, path, is_video):
    if ok_file(path, is_video):
        return True
    for attempt in range(RETRIES):
        try:
            r = creq.get(url, impersonate="chrome", headers=HEADERS, timeout=60)
            if r.status_code != 200:
                raise ValueError(f"HTTP {r.status_code}")
            tmp = path + ".part"
            with open(tmp, "wb") as f:
                f.write(r.content)
            os.replace(tmp, path)
            if not ok_file(path, is_video):
                os.remove(path); raise ValueError("invalid file")
            return True
        except Exception as e:
            print(f"  retry {os.path.basename(path)} ({attempt+1}): {str(e)[:60]}")
            time.sleep(8)
    return False


done = 0
items = sorted(urls.items())
for i, (name, url) in enumerate(items, 1):
    if download(url, os.path.join(OUT, name), name.endswith(".mp4")):
        done += 1
    if i % 100 == 0 or i == len(items):
        print(f"  {i}/{len(items)} ({done} ok)")
    time.sleep(DELAY)
print(f"DONE: {done}/{len(items)} files in {OUT}")
