# Platyplus backups

The one irreplaceable asset is the **user DB** `store.json` (accounts/passkeys/calendar/
plans/logs) at `/home/jmf/gymapp/data/store.json` on the XPS. Code lives on GitHub; the
~24 GB scraped media and generated catalog are gitignored but fully re-derivable
(`npm run import:* && npm run build:catalog`), so they are not backed up.

> **HARD RULE: Emby is out of scope. Never use/modify/depend on Emby's rclone remote,
> config, mount (`/mnt/gdrive`), or `rclone-gdrive.service` for anything Platyplus.**

## How it works (Emby-free, 3-2-1)

- **XPS daily cron** (root): `15 4 * * * /home/jmf/backup-store.sh`
  validate JSON → `gzip -9` → **age** asymmetric-encrypt → `/home/jmf/backups/store-<date>.json.gz.age`
  → rotate (keep 30 dailies; never delete month-start `-01` snapshots).
- **Asymmetric encryption (age):** the XPS holds only the *public* recipient
  (`age1ska29zv5z6y96e3zx6dduczj52el70lsqve2jd9rdxt8crelrenqr60aqu`), so a compromised
  server cannot read its own backups. The **private key lives only on the Mac**:
  `~/.config/platyplus/backup-key.txt` (chmod 600) and Keychain service
  `platyplus-backup-agekey`. Keep a copy in a password manager — if both are lost,
  backups are unrecoverable.
- **Off-server copy:** `rsync -az xps:/home/jmf/backups/ ~/Backups/platyplus/xps/` on the Mac.

## Restore

```sh
age -d -i ~/.config/platyplus/backup-key.txt store-<date>.json.gz.age | gunzip > store.json
scp store.json xps:/home/jmf/gymapp/data/store.json
ssh xps 'cd /home/jmf/gymapp && docker compose restart'
```

## Open gap

Automated **off-site cloud** copy is not wired (the only authorized Drive remote is
Emby's, which is off-limits). To add: stand up a dedicated non-Emby rclone remote (its own
OAuth) or Drive sync on the Mac, then `rclone copy` the `.age` files. Also add a
backup-ran check to `monitor.sh`.
