// #485 — QA=PROD items ALWAYS. Publish the freshly-built generated item list to the SHARED backlog mount so both
// containers serve the SAME list (the server's readItems reads it; the frontend fetches it). NEWEST-# WINS, so an
// older prod build can never clobber a newer QA list. No-op when the shared dir is absent (e.g. a CI build that
// isn't on the box). Runs at the tail of `build:app` (which builds on the self-hosted runner, next to the mount).
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src/data/generated/backlog.json')
const DEST = process.env.SHARED_ITEMS || '/home/jmf/backlog-shared/items.json'
// Compare ROADMAP items only (#1..999). App-added items (#1000+, user reports/admin-adds) live in the triage
// `added` list and are merged client-side — they are NOT in this built list. Counting them here froze publishing
// forever: a stored list polluted with #1000+ had a higher max than every roadmap-only build (#595), so the
// `>= maxN` guard always skipped and To-test went permanently stale (#596, JM 2026-07-20).
const REPORT_BASE = 1000
const maxN = (arr) => (Array.isArray(arr) ? arr : []).reduce((m, it) => { const n = Number(it?.n) || 0; return n < REPORT_BASE && n > m ? n : m }, 0)

if (!existsSync(dirname(DEST))) { console.log(`publish-items: shared dir ${dirname(DEST)} absent — skip (not on the box)`); process.exit(0) }

let list
try { const j = JSON.parse(readFileSync(SRC, 'utf8')); list = Array.isArray(j) ? j : (j.items || []) }
catch (e) { console.log('publish-items: no built list to publish — skip:', e.message); process.exit(0) }

let cur = []
try { const j = JSON.parse(readFileSync(DEST, 'utf8')); cur = Array.isArray(j) ? j : (j.items || []) } catch { cur = [] }

// Republish whenever I'm AT LEAST as new (>= max #) AND the CONTENT differs. The old gate only fired on a HIGHER
// max # / more items, so STATUS-ONLY changes (🔨→🧪 flips, edits, done-marks) never reached the shared list — JM's
// To-test bucket went stale (#485 bug, JM 2026-07-11). The `>= maxN` guard still stops a strictly-OLDER prod build
// from clobbering a newer QA list; identical content is a no-op.
const differs = JSON.stringify(list) !== JSON.stringify(cur)
if (list.length && maxN(list) >= maxN(cur) && differs) {
  const tmp = DEST + '.tmp'; writeFileSync(tmp, JSON.stringify(list)); renameSync(tmp, DEST)
  console.log(`publish-items: published ${list.length} items (max #${maxN(list)}) → ${DEST}`)
} else {
  console.log(`publish-items: shared list already current (${cur.length} items, max #${maxN(cur)}) — kept`)
}
