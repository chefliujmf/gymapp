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
