# Platyplus backups

Platyplus user data (`store.json` — accounts/passkeys/calendar/plans/logs at
`/home/jmf/gymapp/data/store.json` on the XPS) is backed up by the **existing,
shared `backup-secrets` job** — there is ONE backup key for everything, by design.
Code lives on GitHub; the ~24 GB scraped media and generated catalog are gitignored
but re-derivable (`npm run import:* && npm run build:catalog`), so they aren't backed up.

> **HARD RULE: Emby is out of scope. Never use/modify/depend on Emby's mount
> (`/mnt/gdrive`) or `rclone-gdrive.service`.** (The pre-existing backup job below is
> the user's own and predates this; it is the canonical scheme — leave it as-is.)

## The canonical job (not Platyplus-specific — covers all the crown jewels)

- **Script:** `/home/jmf/scripts/backup-secrets.sh`, run by **systemd timer
  `backup-secrets.timer`** daily at **03:30** (enabled + active; verified Result=success).
- **What it captures:** `gymapp/data/store.json`, `gymapp/auth.env`,
  `house_inspector` store.json + `hi-auth.env`, and the rclone token — tar.gz → `age`
  encrypt → Drive at `rclone:backups/secrets/` as `secrets-<stamp>.tar.gz.age`
  (+ `secrets-latest.tar.gz.age`).
- **One key (age):** recipient `age10l374xxtvsgrdtlq9h3zwqta7s496z6m0hqu59te7kqnrnpm5qnsk8jgtd`.
  Private key: `/home/jmf/.config/age/backup-key.txt` on the XPS **and** in Bitwarden
  ("XPS backup age key (decrypts Drive secrets backups)"). Round-trip verified.

## Restore (Platyplus store.json)

```sh
# fetch secrets-latest.tar.gz.age from Drive (backups/secrets), then:
age -d -i backup-key.txt secrets-latest.tar.gz.age | tar -xzO home/jmf/gymapp/data/store.json > store.json
scp store.json xps:/home/jmf/gymapp/data/store.json
ssh xps 'cd /home/jmf/gymapp && docker compose restart'
```

## Notes

- A short-lived second backup (`/home/jmf/backup-store.sh` + a separate age key) was
  created 2026-06-20 and **removed the same day** — it duplicated this job under a 2nd
  key, which we explicitly don't want. If that 2nd key (`age1ska29…`) was added to
  Bitwarden, delete it; keep only the canonical `age10l374xx…` key.
- TODO: have `monitor.sh` alert if `backup-secrets.service` hasn't succeeded in >36 h.
