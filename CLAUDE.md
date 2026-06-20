# Platyplus (gymapp) — maintenance guide for Claude

Read this before changing anything here. It lists the invariants and the
"when you change X, also update Y" rules so nothing drifts.

## Architecture (how it runs)
- One Node container (`gymapp-auth`, `server/server.js`): serves the built SPA,
  handles **password + passkey auth** (own `store.json`), proxies intervals.icu,
  and serves **self-hosted media** at `/media/*` from a mounted volume.
- Runs on the always-on XPS via `docker compose` (`docker-compose.yml`).
- Public at `https://platyplus.duckdns.org` via NPM (HA Green). Passkeys bind to
  that exact domain (RP_ID) — the TLS cert MUST match it.
- Deploy = **3-env CI/CD** (see DEPLOY.md): CI on every push/PR; `dev` push → **QA/staging**
  auto-deploy; PR `dev`→`main` (CI green) → **prod** auto-deploy via the XPS self-hosted
  runner (`build:app` + synced catalog). `npm run deploy` from the Mac is the hotfix path.

## INVARIANT: 100% media independence (do not break)
- The catalog must contain **zero** third-party media URLs (Centr, MuscleWiki,
  jwplayer/jwplatform, JOIN/digitaloceanspaces, drive.google). Everything is a
  `/media/...` path served from our XPS, or dropped (UI shows an emoji).
- `scripts/build-catalog.mjs` enforces this with an **independence gate** that
  FAILS the build if any third-party media URL appears. Never weaken it.
- Media lives on the XPS at `/home/jmf/gymapp/media/{video,audio,images/...}`
  (served via the `./media:/srv/media:ro` mount). Catalog paths must match the
  on-disk layout.

## When you change X, also update Y
| Change | Also update |
|--------|-------------|
| Add/modify any `/api/*` or `/auth/*` endpoint in `server/server.js` | **`server/openapi.json`** (the Swagger spec at `/api/docs`) — keep it in sync |
| **Add a file/module under `server/`** | nothing to hand-list — `server/Dockerfile` does `COPY *.js` so it's baked in; CI builds + **smoke-tests the server image** (module-graph check). Any `server/` change **rebuilds the image** (not just `dist/`) — make sure that CI step is green before merge. (A missing-COPY once crash-looped prod.) |
| Add a new media source/type | `scripts/build-catalog.mjs` self-host fn + gate; download via `scripts/fetch-missing-media.mjs`; upload to the XPS `media/` and redeploy |
| **Add/replace content** (exercises, recipes, audio) | **`CONTENT.md`** — the runbook: importer → build-catalog (free-first de-dup) → host images + `npm run sync:catalog` → `content-manifest` (license/commercial) → deploy |
| **Ship a user-facing batch to prod** | add a block to **`src/data/releases.ts`** (the in-app "What's new" bell) |
| Change how media is referenced | re-run the build; confirm the **gate is green** |
| Change deploy/infra/containers | **`RESTORE.md`** and this file |
| Change the build pipeline | `scripts/*` stay consistent (`build-catalog`, `fetch-missing-media`) |
| New UX feature using the calendar | use `calApi` (`src/calendar.ts`); document new endpoints in openapi.json |

## Tools / scripts (keep current)
- `scripts/build-catalog.mjs` — builds `src/data/generated/*` from `downloaded_pages/`. Self-hosts all media + runs the independence gate.
- `scripts/fetch-missing-media.mjs` — downloads still-images the catalog references but we don't have yet (idempotent).
- `deploy` flow per DEPLOY.md / RESTORE.md.

## Logs & health (for the monitoring routine)
- Containers log to Docker's json-file driver, **rotated** (`max-size 10m`,
  `max-file 5`) — see `docker-compose.yml`.
- Check: `ssh xps 'docker logs --since 1h gymapp'` and
  `ssh xps 'docker ps --format "{{.Names}} {{.Status}}"'` (Status shows healthy/unhealthy).
- Healthcheck hits `/auth/config`. A routine should alert on `unhealthy` or
  error spikes in logs. `monitor.sh` also alarms if the daily `backup-secrets`
  job goes stale (>36h) or fails.
- **PROD (and QA/staging) DOWN = top priority — drop everything, triage now.**
  Read logs, find root cause, fix via the CI/CD pipeline (manual `docker compose
  up --build` on prod is blocked), redeploy, and verify `healthy` + HTTP 200
  before calling it fixed.

## Data that matters (backed up)
- `data/store.json` — accounts/passkeys (nightly **encrypted** backup to Drive).
- `auth.env` — secrets (same backup). Media + dist sync separately (weekly/Drive).
