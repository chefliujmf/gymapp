# Platyplus — local dev

Iterate on the UI fast, without deploying to prod.

## Run
```bash
npm install      # first time
npm run dev      # http://localhost:5173 (Vite HMR)
```
- Full UI loads with the bundled catalog.
- **Media (images/video/audio) is proxied read-only from prod** (`vite.config.ts`)
  — real images show; nothing is ever written to prod.
- `/icu` and `/auth` are also proxied to prod. ⚠️ Authed **write** flows (saving
  calendar items/plans) would hit your **prod** account — don't test writes here;
  that's what the planned XPS staging stack is for. Login may not persist over
  http localhost (prod sets a Secure cookie); you don't need to be logged in for UI work.

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
