#!/usr/bin/env bash
# #472 — reconnect Tailscale non-interactively from the stored reusable auth key, so box ssh never needs a
# manual browser re-auth. The real key lives in .secrets/tailscale.env (gitignored). Idempotent.
TS="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
[ -x "$TS" ] || { echo "no tailscale app"; exit 0; }
# already up? nothing to do.
"$TS" status >/dev/null 2>&1 && exit 0
SECRETS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.secrets/tailscale.env"
[ -f "$SECRETS" ] && . "$SECRETS"
[ -n "$TAILSCALE_TOKEN" ] || { echo "no TAILSCALE_TOKEN in .secrets/tailscale.env"; exit 1; }
"$TS" up --authkey="$TAILSCALE_TOKEN" --accept-routes >/dev/null 2>&1 && echo "tailscale reconnected" || echo "tailscale up failed"
