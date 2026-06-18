# Restore / rebuild Platyplus (gymapp) from scratch

Platyplus runs on the always-on server in one Docker container (`gymapp-auth`):
a Node service that serves the built SPA, handles password + passkey auth, and
proxies intervals.icu. From-scratch recovery on a fresh Linux machine:

## You need
- Docker + the Compose plugin, `rclone` (configured for Google Drive), `age`, Node (to build)
- Your **age backup key** (from Bitwarden) — decrypts the secrets backup

## Steps
```bash
# 1. Code
git clone https://github.com/chefliujmf/gymapp.git ~/dev/gymapp
cd ~/dev/gymapp

# 2. Restore accounts (store.json) + secrets (auth.env) from the ENCRYPTED backup.
#    Paste your age key from Bitwarden into ./backup-key.txt first.
rclone copyto rclone:backups/secrets/secrets-latest.tar.gz.age ./secrets.age
age -d -i ./backup-key.txt ./secrets.age | tar xzf - -C /
#    -> /home/jmf/gymapp/data/store.json  (accounts + passkeys)
#       /home/jmf/gymapp/auth.env         (RP_ID, ORIGIN, SEED_*, intervals.icu key)
rm -f ./secrets.age ./backup-key.txt
# put them where compose expects (compose uses ./data and ./auth.env next to it):
mkdir -p /home/jmf/gymapp/data
ln -s /home/jmf/gymapp /home/jmf/gymapp 2>/dev/null || true   # if cloned elsewhere, copy data/ + auth.env in

# 3. Build the SPA (dist/) — OR restore the last built dist from Drive:
npm install && npm run build
#   fast alternative: rclone copy rclone:backups/gymapp-dist ./dist

# 4. Launch
docker compose up -d --build

# 5. Verify
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8088/                         # 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8088/auth/login \
  -H 'Content-Type: application/json' -d '{"login":"<email>","password":"<pw>"}'         # 200
```

## Media
Exercise audio/video/images live in Google Drive under `gymapp/{audio,video,images}`
(cold backup) and the app references them at runtime. (If/when media is self-hosted
on the server, restore with `rclone copy rclone:gymapp/... /home/jmf/gymapp/media/...`.)

## Networking (Nginx Proxy Manager on HA Green)
- Proxy host `platyplus.duckdns.org` -> `http://<server-LAN-ip>:8088`
- SSL: Let's Encrypt via **DNS challenge -> DuckDNS**, Force SSL.
- Passkeys require this valid cert (RP_ID = `platyplus.duckdns.org`).

## Notes
- `auth.env` is the secret (gitignored); `docker-compose.yml` is the run recipe.
- Updating the app = rsync new `dist/` then `docker compose restart` (no rebuild
  unless `server/` changed -> `docker compose up -d --build`).
- Accounts/passkeys: `/home/jmf/gymapp/data/store.json` (nightly encrypted backup).
