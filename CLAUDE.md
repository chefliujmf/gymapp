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
  auto-deploy. **Prod promotion = one click** (repo → Actions → "Promote to prod" → Run workflow,
  AFTER testing QA): `promote-prod.yml` opens/reuses a `dev`→`main` PR and enables **auto-merge**, so
  it ships once the protected-branch `build` check passes → `deploy.yml` (push:`main`, CI-gated)
  deploys **prod** via the XPS self-hosted runner (`build:app` + synced catalog). So: push `dev` →
  test on QA → Run workflow → prod. Auth = Actions secret `PROMOTE_TOKEN` (fine-grained PAT, Contents+PRs
  write, configured **no-expiration** → set-and-forget; a PAT's PR triggers the `build` check, `GITHUB_TOKEN`'s
  would not). Repo "Allow auto-merge" on. `npm run deploy` = Mac hotfix path.

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

## Secrets — GitHub Secrets are the master (since 2026-06-23)
- All app secrets live in **GitHub Actions secrets**, one blob per env: `AUTH_ENV_PROD`
  and `AUTH_ENV_STAGING` (the full `auth.env` contents). The deploy jobs inject them
  (`env: AUTH_ENV: ${{ secrets.AUTH_ENV_* }}`) and `scripts/deploy.sh` / `deploy-staging.sh`
  **regenerate `auth.env` on the box** from that before `docker compose up`. Rotate a token =
  edit the secret, redeploy. The on-box `auth.env` is now a derived runtime copy (the app
  can't read GitHub Secrets directly). The Mac hotfix path leaves it untouched (no `AUTH_ENV`).
- `PROMOTE_TOKEN` (Actions secret) is the prod-promotion PAT — used by `promote-prod.yml` only.
- When you change `auth.env` keys, update **both** the GitHub Secret blob and this list.

## Data that matters (backed up)
- `data/store.json` — accounts/passkeys (nightly **encrypted** backup to Drive).
- `auth.env` — derived from GitHub Secrets at deploy (still backed up). Media + dist sync separately (weekly/Drive).
