#!/usr/bin/env python3
"""Import vegetarian + vegan recipes from TheMealDB (free, open recipe API)
into the app's recipe format.

TheMealDB: https://www.themealdb.com/api.php  (test key "1" used here)
Output: src/data/recipes/themealdb.json  (gitignored, merged into the catalog).

Stdlib only — no pip install needed.

Usage:
    python3 scripts/import_themealdb.py
"""

from __future__ import annotations

import json
import re
import time
import urllib.request
from pathlib import Path

API = "https://www.themealdb.com/api/json/v1/1"
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "recipes" / "themealdb.json"

# TheMealDB categories that fit a vegetarian app and their diet tag.
CATEGORIES = {"Vegetarian": "vegetarian", "Vegan": "vegan"}


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "gymapp-importer"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def slug(s: str) -> str:
    return "tmdb-" + re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def meal_category(strCategory: str) -> str:
    c = (strCategory or "").lower()
    if "breakfast" in c:
        return "breakfast"
    if "dessert" in c or "starter" in c or "side" in c:
        return "snack"
    return "dinner"


def ingredients(meal: dict) -> list[str]:
    out = []
    for i in range(1, 21):
        ing = (meal.get(f"strIngredient{i}") or "").strip()
        mea = (meal.get(f"strMeasure{i}") or "").strip()
        if ing:
            out.append((f"{mea} {ing}").strip())
    return out


def steps(instructions: str) -> list[str]:
    text = (instructions or "").replace("\r", "\n")
    parts = [p.strip() for p in re.split(r"\n+", text) if p.strip()]
    if len(parts) <= 1:  # one block — split into sentences
        parts = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    return parts[:20]


def to_recipe(meal: dict, diet: str) -> dict:
    title = meal.get("strMeal", "Recipe")
    tags = [t.strip() for t in (meal.get("strTags") or "").split(",") if t.strip()]
    diet_tags = ["vegetarian"] if diet == "vegan" else [diet]
    if diet == "vegan":
        diet_tags.insert(0, "vegan")
    return {
        "id": slug(title),
        "title": title,
        "category": meal_category(meal.get("strCategory", "")),
        "minutes": 30,  # TheMealDB has no time; sensible default
        # TheMealDB has no macros — left at 0, shown as "—" in the UI.
        "kcal": 0, "protein": 0, "carbs": 0, "fat": 0,
        "ingredients": ingredients(meal),
        "steps": steps(meal.get("strInstructions", "")),
        "thumbnail": meal.get("strMealThumb") or None,
        "tags": list(dict.fromkeys([*tags, *diet_tags, "imported"])),
        "diet": diet_tags,
        "source": meal.get("strSource") or f"https://www.themealdb.com/meal/{meal.get('idMeal')}",
    }


def main() -> None:
    recipes: dict[str, dict] = {}
    for cat, diet in CATEGORIES.items():
        listing = get(f"{API}/filter.php?c={cat}").get("meals") or []
        print(f"{cat}: {len(listing)} meals")
        for stub in listing:
            mid = stub["idMeal"]
            detail = get(f"{API}/lookup.php?i={mid}").get("meals")
            if not detail:
                continue
            r = to_recipe(detail[0], diet)
            recipes.setdefault(r["id"], r)  # dedupe by id
            time.sleep(0.15)  # be polite to the free API

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"recipes": list(recipes.values())}, indent=2))
    print(f"Wrote {len(recipes)} recipes -> {OUT.relative_to(OUT.parents[3])}")


if __name__ == "__main__":
    main()
