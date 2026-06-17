#!/usr/bin/env python3
"""Convert a Centr library JSON export (the /library/recipes API response you
saved while logged in) into the app's recipe format.

Maps the listing metadata — title, photo, prep/cook time, tags, serves — and
deep-links each card to the full recipe on Centr (ingredients/steps/macros live
on the detail page, not in this listing).

Accepts one or more saved JSON files (e.g. one per page). Dedupes by recipe id.
Output: src/data/recipes/centr.json  (gitignored, merged into the catalog).

Usage:
    python3 scripts/import_centr.py ~/Downloads/recipes.json [more.json ...]
    python3 scripts/import_centr.py ~/Downloads/centr_pages/*.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "recipes" / "centr.json"

# preferred image sizes, best first
IMG_KEYS = ["landscapemobile2x", "landscape32medium2x", "landscapemobile1x", "landscape32small2x"]


def pick_image(image_list: dict | None) -> str | None:
    if not isinstance(image_list, dict):
        return None
    for k in IMG_KEYS:
        if k in image_list and image_list[k].get("url"):
            return image_list[k]["url"]
    for v in image_list.values():  # fall back to any url
        if isinstance(v, dict) and v.get("url"):
            return v["url"]
    return None


def to_recipe(c: dict) -> dict:
    cid = c.get("contentId")
    url = c.get("urlPartial", "")
    minutes = (c.get("prepTime") or 0) + (c.get("cookTime") or 0)
    tags = [t["name"] for t in (c.get("tags") or []) if isinstance(t, dict) and t.get("name")]
    return {
        "id": f"centr-{cid}",
        "title": c.get("title", "Recipe"),
        "category": "snack" if c.get("isSnack") else "dinner",
        "minutes": minutes or 20,
        # listing carries no macros — shown as "—" in the UI
        "kcal": 0, "protein": 0, "carbs": 0, "fat": 0,
        "ingredients": [],   # on the Centr detail page (see source link)
        "steps": [],
        "thumbnail": pick_image(c.get("imageList")),
        "tags": tags[:6],
        "servings": c.get("serves"),
        "source": f"https://centr.com/recipe/overview/0/{cid}/{url}",
    }


def main() -> None:
    files = sys.argv[1:] or [str(Path.home() / "Downloads" / "recipes.json")]
    recipes: dict[str, dict] = {}
    pages = 0
    for f in files:
        try:
            data = json.loads(Path(f).read_text())
        except Exception as e:  # noqa: BLE001
            print(f"skip {f}: {e}")
            continue
        contents = (data.get("result") or {}).get("contents") or []
        pages += 1
        for c in contents:
            r = to_recipe(c)
            recipes.setdefault(r["id"], r)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"recipes": list(recipes.values())}, indent=2))
    print(f"Read {pages} file(s) -> {len(recipes)} recipes -> src/data/recipes/centr.json")


if __name__ == "__main__":
    main()
