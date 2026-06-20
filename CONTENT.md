# Content pipeline & licensing (runbook)

How the exercise/recipe/media library is built, kept resell-safe, and recovered.
**This is the repeatable process — follow it for every new content source.**

## The flow (source → app)
1. **Importer** (`scripts/import-<source>.mjs`) fetches a source's data + **downloads its
   media into `downloaded_pages/<source>_images/`** (we always self-host — the build's
   *independence gate* fails on any third-party media URL).
2. **`scripts/build-catalog.mjs`** merges the source into the catalog:
   - a `<source>Extras(have)` / `<source>Recipes(have)` fn that adds items **not already
     present** (de-dup by normalized name/title).
   - **FREE-FIRST de-dup order**: resell-safe sources win, scraped (Centr/MuscleWiki) only
     fill gaps. Current order — exercises: `free-exercise-db → MuscleWiki → Centr`;
     recipes: `TheMealDB → Centr`.
   - every item carries a `source`; the **`LICENSE` map** → `content-manifest.json/.csv`
     with **`commercial` = YES | NO | CHECK** per item.
3. **Host + sync** (the two things that must reach the XPS):
   - `rsync -az downloaded_pages/<source>_images/ xps:/home/jmf/gymapp/media/images/<source>_images/`
   - `npm run sync:catalog`  (pushes `src/data/generated/` → `/home/jmf/content/generated`)
4. **Deploy**: PR `dev` → `main` (CI green) → the XPS runner rebuilds with the synced
   catalog. Verify a media URL returns 200 and the gate passed.

## Licensing — the rule
**Use 100%-resell-safe first; scraped only as personal-use fallback.** Recorded in
`content-manifest.csv`:
- ✅ **YES (resell-safe):** free-exercise-db (Public Domain). 873 exercises.
- ⚠️ **CHECK (free, verify + attribute):** TheMealDB (recipes). CC sources (audio) — per track.
- ❌ **NO (personal only):** Centr, MuscleWiki, ExerciseDB media, muscleandstrength,
  Pilates.com, Yoga-with-Adriene, DoYogaWithMe, exerciselibrary.com.
- ⬜ For the SELL build, **filter the catalog to `commercial !== 'NO'`** using the manifest.
- ⬜ CC-BY / CC-BY-SA need an in-app **attribution surface** (not built yet).

## Recovery / backup
- **Importers + build-catalog + the manifest are in git** → the library is fully
  **regenerable**. The XPS `media/` and `/home/jmf/content/generated` are derived copies.
- To rebuild from scratch: re-run each `scripts/import-*.mjs` (re-downloads media) →
  `npm run build:catalog` → host images + `npm run sync:catalog` → deploy.
- The 24 GB raw scrape (`downloaded_pages/`) is Mac-only and gitignored (third-party IP) —
  back it up locally if you care to keep the *scraped* (non-resell) set; the resell-safe set
  re-fetches from public sources.

## Add a NEW source (checklist)
1. Verify the **license** (commercial OK?). Add it to the `LICENSE` map in build-catalog.
2. Write `scripts/import-<source>.mjs` (mirror `import-free-exercise-db.mjs`): fetch data,
   download media to `downloaded_pages/<source>_images/`, write mapped JSON.
3. Add `<source>Extras(have)` to build-catalog; insert in the **free-first** de-dup order.
4. `node scripts/build-catalog.mjs` → check counts + `independence gate: OK`.
5. Host images (`rsync … media/images/<source>_images/`) + `npm run sync:catalog`.
6. Commit (importer + build-catalog + manifest) → PR → prod. Verify a media 200.
