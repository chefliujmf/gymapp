#!/usr/bin/env bash
# Push the freshly-generated catalog to the XPS so the self-hosted runner builds
# current content. Run this after re-scraping (which regenerates src/data/generated).
# The catalog is ~3.6 MB, derived from scraped content — kept on the XPS filesystem,
# never in git. The served media already lives on the XPS.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XPS_HOST="${XPS_HOST:-xps}"
CATALOG_DIR="${CATALOG_DIR:-/home/jmf/content/generated}"

if [ ! -d "$REPO/src/data/generated" ]; then
  echo "no src/data/generated — run 'npm run build:catalog' first" >&2; exit 1
fi
echo ">> syncing catalog to ${XPS_HOST}:${CATALOG_DIR}"
ssh "$XPS_HOST" "mkdir -p '$CATALOG_DIR'"
rsync -az --delete "$REPO/src/data/generated/" "${XPS_HOST}:${CATALOG_DIR}/"
echo "OK: catalog synced ($(ls "$REPO/src/data/generated" | wc -l | tr -d ' ') files). New content reaches prod on the next merge to main."
