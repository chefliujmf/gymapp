#!/usr/bin/env python3
"""Download the unique exercise demo videos referenced by the catalog.

Same pipeline as the meditation audio: download locally (resumable, retried),
then rsync to the XPS and rclone to Drive `gymapp/video`. Files are named by the
JWPlayer basename (e.g. 3EwEl0sw-f9Vyd3qF.mp4) so the catalog can be remapped to
the Drive copies later. Output is gitignored (downloaded_pages/).
"""
import os
import json
import time
import requests
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKOUTS = os.path.join(ROOT, "src", "data", "generated", "workouts.json")
OUT = os.path.join(ROOT, "downloaded_pages", "exercise_videos")
os.makedirs(OUT, exist_ok=True)

DELAY = 0.3
MAX_RETRIES = 4
RETRY_WAIT = 10
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

# Collect unique video URLs keyed by their filename.
data = json.load(open(WORKOUTS))
urls = {}
for w in data:
    for e in w.get("exercises", []):
        v = e.get("video")
        if v:
            name = os.path.basename(urlparse(v).path)  # 3EwEl0sw-f9Vyd3qF.mp4
            urls[name] = v
print(f"{len(urls)} unique exercise videos to fetch")


def is_valid_mp4(path):
    """Quick sanity check: a real mp4 has an 'ftyp' box near the start."""
    try:
        with open(path, "rb") as f:
            head = f.read(16)
        return b"ftyp" in head and os.path.getsize(path) > 10000
    except Exception:
        return False


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    for attempt in range(MAX_RETRIES):
        try:
            with requests.get(url, headers={"User-Agent": UA}, stream=True, timeout=90) as r:
                r.raise_for_status()
                tmp = path + ".part"
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
                os.replace(tmp, path)
            if not is_valid_mp4(path):
                print(f"  !! {os.path.basename(path)} is not a valid mp4 — removing")
                os.remove(path)
                raise ValueError("invalid mp4")
            return True
        except Exception as e:
            print(f"  failed {os.path.basename(path)} (attempt {attempt+1}): {str(e)[:80]}")
            time.sleep(RETRY_WAIT)
    return False


done = 0
items = sorted(urls.items())
for i, (name, url) in enumerate(items, 1):
    if download(url, os.path.join(OUT, name)):
        done += 1
    if i % 50 == 0 or i == len(items):
        print(f"  {i}/{len(items)} ({done} ok)")
    time.sleep(DELAY)

print(f"DONE: {done}/{len(items)} valid videos in {OUT}")
