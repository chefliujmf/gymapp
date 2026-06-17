# GymApp — personal self-hosted fitness PWA

A Centr-style personal training app you own and host yourself. Browse workouts,
follow multi-week programs, view recipes, and track what you've completed — all
on your phone, installable from the browser (no Play Store needed). Video
playback is designed to stream from **your own Emby server**.

> Personal use. Content you bring in (e.g. from a Centr subscription you pay for)
> stays on your own server for your own use — not for redistribution.

## Stack

- **Vite + React + TypeScript** — static build, hosts anywhere
- **vite-plugin-pwa** — installable, offline app shell, auto-update
- **Dexie (IndexedDB)** — your logs/progress live on-device, no backend required

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/  (static files)
npm run preview    # serve the production build
```

Icons are pre-generated; regenerate with `node scripts/gen-icons.mjs`.

## Install on Android

1. Serve `dist/` over HTTPS (see hosting below).
2. Open the URL in Chrome on your phone → menu → **Install app / Add to Home screen**.
3. It launches full-screen like a native app.

Want a real `.apk` for the Play Store or sideloading? Wrap this PWA with
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (TWA) — no code
changes needed.

## Hosting on the XPS (Emby/Deluge) box — live

Deployed and served over HTTPS on the tailnet via Tailscale Serve:

```bash
# build locally, copy to the box, serve (one-time)
npm run build
rsync -az --delete dist/ jmf@100.104.241.95:/home/jmf/gymapp/dist/
ssh root@100.104.241.95 'tailscale serve --bg /home/jmf/gymapp/dist'
```

Live at **https://jmf-xps-13-9343.tail8ece92.ts.net/** (tailnet-only, auto TLS
cert via Tailscale, MagicDNS). The serve config persists across reboots, so
**redeploys are just the rsync line** — Tailscale picks up the new files with no
restart. Stop with `tailscale serve --https=443 off`.

PWA install **requires HTTPS** — Tailscale Serve provides a valid cert
automatically, which is why this route is used instead of plain nginx:80.

### Wiring up video (Emby)

Each workout has an optional `videoUrl`. Point it at an Emby stream URL, e.g.
`https://<emby-host>/Videos/<itemId>/stream.mp4?api_key=<key>`. Until then the
player shows a friendly "no video linked" placeholder and the rest of the app
works fully.

## Bringing in your Centr content

`scripts/centr-collect.mjs` reuses the logged-in Centr session saved by the
sibling `cyclingcoach` project (`.secrets/centr_state.json`) and writes
`src/data/centr/workouts.json`, which is merged into the catalog at build time
(gitignored — personal content never gets committed).

```bash
npm i -D playwright && npx playwright install chromium
node scripts/centr-collect.mjs
```

Centr's DOM changes over time, so treat the selectors in that script as a
starting point. It captures **metadata**; you download the videos into your
Emby library separately and set each `videoUrl` to the Emby stream.

## Project layout

```
src/
  data/catalog.ts   seed workouts/programs/recipes (+ merges src/data/centr/*.json)
  data/centr/        collected personal content (gitignored)
  pages/             Today, Workouts, Programs, Recipes, Progress + detail views
  db.ts              Dexie schema + helpers (logs, enrollments, settings)
  types.ts           domain model
  ui.tsx             shared cards / icons
scripts/
  gen-icons.mjs      generates PWA PNG icons
  centr-collect.mjs  optional Centr collector
```
