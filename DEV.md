# Platyplus — local dev

Iterate on the UI fast, without deploying to prod.

## Run (full local stack — frontend + its own API, no prod writes)
```bash
npm install            # first time (also: cd server && npm install)
npm run dev:full       # backend (:8088, dev data) + Vite (:5173) together
# open http://localhost:5173  — log in with  jmfiset / devpass
```
- **Frontend** (Vite HMR) at `:5173`.
- **API + auth** run locally (`npm run dev:api`, `scripts/dev-api.sh`) against an
  **isolated dev store** (`server/dev-data/store.json`, gitignored) — **never
  touches prod**. `RP_ID=localhost` so **passkeys work** on localhost.
- **Media** (images/video/audio) is proxied **read-only from prod** — real images
  show without a local copy.
- `/icu` (intervals) is proxied straight to intervals.icu; the dev account has no
  key, so Today shows the "connect" prompt — fine for UI work.
- Frontend-only (no API needed)? `npm run dev`.

## Promote to prod (when validated)
```bash
npm run build                                   # runs the independence gate
rsync -az --delete dist/ xps:/home/jmf/gymapp/dist/
ssh xps 'cd /home/jmf/gymapp && docker compose restart'   # up -d --build if server/ changed
```

## Planned: XPS staging (pre-prod gate)
A parallel `*-dev` compose stack on the XPS with its own data + dev subdomains
(`platyplus-dev.duckdns.org`, NPM + cert) for full prod parity incl. **passkeys**.
Deploy-to-dev → validate → promote-to-prod. Not built yet (chosen: local dev first).
