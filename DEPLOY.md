# Deploy gymapp → https://gymmingapp.duckdns.org (HA Green)

HTTPS is required for **Web Bluetooth** (trainer/HR) and to **install the PWA** on the
Pixel. Goal: serve the built `dist/` over HTTPS and reverse-proxy intervals.icu.

> ⚠️ **Safe for your existing nginx.** Everything here is *additive*: one new file
> `conf.d/gymapp.conf` with its own `server_name gymmingapp.duckdns.org` — it does
> **not** edit or replace any of your current config. Always run **`nginx -t`** before
> reloading, and reload with `nginx -s reload` (graceful, no dropped connections).
> Nothing is applied to your server automatically — you review and run each step.
> **Check first** that `gymmingapp.duckdns.org` isn't already used by another vhost
> (e.g. Home Assistant). If it is, give gymapp its own subdomain instead.

## CI/CD (current)

Prod = `platyplus.duckdns.org` on the XPS (docker compose, port 8088 → NPM/HTTPS).

**CI — automatic.** `.github/workflows/ci.yml` runs on every push to `dev`/`main` and
every PR into `main`: `npm ci && npm run build` (catalog gen + independence gate +
`tsc -b` + vite build). The scraped catalog isn't in the repo, so CI builds against
empty stubs — enough to catch type/build breakage before it reaches `main`.

**CD — one command from the Mac.** Deploy is `npm run deploy` (`scripts/deploy.sh`):
build `dist/` here → rsync `dist/` + `server/` to the XPS → `docker compose up -d --build`
→ **wait for the container healthcheck** (fails loudly + dumps logs if unhealthy).

```bash
npm run deploy                  # build + deploy + health-gate (Mac → XPS)
SKIP_BUILD=1 npm run deploy     # reuse an existing ./dist
```

**Why no GitHub "merge → auto-deploy" runner:** the build needs the **24 GB of scraped
Centr/MuscleWiki content** (gitignored — third-party IP), which lives only on the Mac.
A self-hosted runner that *rebuilt on the XPS* would need that content (or the derived
catalog) on the box — neither is acceptable — and adds nothing, since the build must
happen where the content legally lives. So the Mac is the build origin and `deploy.sh`
is the deploy. **If GitHub-triggered CD is ever wanted**, the only sound shape is: Mac
builds `dist/` and uploads it as a release artifact, and a self-hosted runner on the XPS
downloads + deploys that prebuilt artifact (no rebuild). Not built — flagged in the backlog.

**Promote dev → prod:** merge `dev` → `main` (CI gates it), then `npm run deploy`.

## ⭐ Your setup: NPM (HA Green) + isolated container on the XPS

The build is already staged on the XPS at `~/gymapp/dist` + `~/gymapp/nginx.conf`.
Two manual steps (they need your docker/sudo + the NPM UI):

**1. Start the container on the XPS** (isolated nginx — does NOT touch host nginx):

```bash
ssh jmf@10.0.0.182      # or the Tailscale IP
sudo docker run -d --name gymapp --restart unless-stopped -p 8088:80 \
  -v /home/jmf/gymapp/dist:/usr/share/nginx/html:ro \
  -v /home/jmf/gymapp/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8088/    # expect 200
```
*(Optional, so I can manage it next time without sudo: `sudo usermod -aG docker jmf` then re-login.)*

**2. In Nginx Proxy Manager (HA Green), add one Proxy Host:**
- **Details:** Domain `gymmingapp.duckdns.org` · Scheme `http` · Forward Hostname `10.0.0.182` · Forward Port `8088` · ✅ Block Common Exploits · ✅ Websockets Support
- **SSL:** Request a new Let's Encrypt cert → use **DNS Challenge → DuckDNS** (paste your DuckDNS token) · ✅ Force SSL · ✅ HTTP/2
- *(No custom locations needed — the container already handles `/icu` + SPA routing.)*

**3. Router:** ensure 443 (and 80) forward to HA Green/NPM (probably already, since NPM is your reverse proxy). Confirm `10.0.0.182:8088` is reachable from HA Green (same LAN).

**To update later:** I re-`rsync` the new `dist/` to the XPS and you run
`sudo docker restart gymapp` (or nothing — the volume is live; just hard-refresh).

---

## Reference (generic)

## 1. Build

```bash
npm run build         # → dist/  (static PWA, ~4.7 MB)
```

## 2. DNS + cert (you likely already have this)

- **DuckDNS** `gymmingapp.duckdns.org` → your home public IP. The Home Assistant
  **DuckDNS add-on** keeps it updated **and** provisions a Let's Encrypt cert to
  `/ssl/fullchain.pem` + `/ssl/privkey.pem`. If you use it, the cert is done.
- **Router**: forward TCP **443** (and **80** for the redirect) to the HA Green LAN IP.
  - *On home wifi only?* You can skip port-forwarding and reach it at the LAN IP, but
    the cert is for the domain — so use the domain (split-horizon DNS or a hosts entry).

## 3. Put the files + nginx config

Copy `dist/` to the web root and install the server block:

```bash
# from this repo (adjust user@host + paths to your HA Green access):
rsync -a --delete dist/ <user>@<ha-green>:/var/www/gymapp/
scp deploy/nginx-gymapp.conf <user>@<ha-green>:/etc/nginx/conf.d/gymapp.conf
ssh <user>@<ha-green> 'nginx -t && nginx -s reload'
```

> If nginx on HA Green is the **Nginx Proxy Manager** add-on (UI, not raw conf):
> add a **Proxy Host** for `gymmingapp.duckdns.org` with SSL (request a Let's Encrypt
> cert via its **DuckDNS DNS challenge**), point it at a small static server for
> `dist/`, and add a **Custom location** `/icu/` → `https://intervals.icu`. The raw
> `deploy/nginx-gymapp.conf` is the reference for those settings.

## 4. First run on the Pixel

1. Open **https://gymmingapp.duckdns.org** in **Chrome** (Android).
2. **Profile → paste your intervals.icu API key → Save & sync** (the dev `.env.local`
   auto-connect is not in production, so enter it once; it stays on the device).
3. **Install**: Chrome menu → *Add to Home screen* → launches full-screen.
4. **Ride → Ride now → Add a device** → pair the Tacx + Polar (remembered after).

## Updating later

Re-run `npm run build` and the `rsync` in step 3. The service worker auto-updates
(the shell is served `no-cache`), so a refresh picks up the new version.
