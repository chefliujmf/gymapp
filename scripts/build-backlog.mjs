// Parse FEEDBACK-LOG.md → a LEAN src/data/generated/backlog.json for the in-app Admin backlog
// page (#438). We ship { n, status, title, summary } only — NOT the full bodies (the log is ~305 KB /
// ~290 items). Rebuilt on every deploy (part of build:app) so the in-app list tracks the .md. JM's live
// triage (priority / comments / discard) is a SEPARATE DB overlay merged at render time — never in here.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const md = readFileSync(join(root, 'FEEDBACK-LOG.md'), 'utf8')

// A backlog item = a line that starts at col 0 with `NNN. <status-emoji> **Title**`. Continuation lines
// are indented; a numbered line WITHOUT a **bold title** (e.g. a test-guide step) is NOT an item.
const HEAD = /^(\d+)\.\s+(.+?)\s*\*\*(.+?)\*\*(.*)$/u
// #488 fix — a title whose **bold** WRAPS onto the next line has no closing ** on line 1, so HEAD misses it and the
// whole item vanished from the Road map (silent drop). HEAD_OPEN catches "NNN. <status> **…" with no close yet; the
// parser then gathers continuation lines into the title until the closing **. Tried only AFTER HEAD fails.
const HEAD_OPEN = /^(\d+)\.\s+(.+?)\s*\*\*(.*)$/u
const statusOf = (e) => (e.includes('✅') ? 'done' : e.includes('🧪') ? 'totest' : e.includes('✗') ? 'fail' : 'todo') // ✅→done · 🧪→totest · ✗→fail · 🔨/⬜/anything else → todo (build merged into todo)
// what to test — the "Verify:/Manual test:" clause I write in the entry (shown as a callout in a test status)
const testOf = (body) => { const m = body.match(/\b(?:Verify|Manual test|To test)\b\s*:?\s*(.{5,240}?)(?:\.\s|\.$|$)/i); return m ? m[1].trim() : '' }
// #449 — how FAR through dev→qa→prod the item has propagated. A BUILT item (🧪/✗/✅) is, by our pipeline,
// committed + auto-deployed to QA, so it's at least qa; 'prod' once the entry shows it was promoted. A
// ⬜ todo isn't built → nowhere yet (''). The client renders a DEV·QA·PROD progression from this level.
const envLevel = (status, body) => {
  if (status === 'todo') return '' // not built → not deployed anywhere
  if (status === 'totest' || status === 'fail') return 'qa'
  // done → check the prod-promotion heuristic, else it's at least on QA
  const b = body.toLowerCase()
  const onProd = /deployed to prod|on prod\b|to prod\b|prod \(pr|\bpromoted\b|live on prod|prod deploy|→ ?prod|✅[^.]*prod/.test(b)
  return onProd ? 'prod' : 'qa'
}
// #454 — derive ONE functional AREA per item from keywords in its title+summary (first match wins,
// specific → general). Powers the in-app area filter. Keep this list in sync with AdminBacklog's area chips.
// Areas MIRROR the current app pages. #488 — Today was merged INTO Plan, so there's no 'today' area; check-in /
// readiness now tag 'plan'. #491 — Eat is deactivated (kept for history). Recovery is a kept first-class section.
const AREA_RULES = [
  ['cycling', /ftp|eftp|\bcp\b|cycling|\bride\b|\brides\b|power curve|sweet-spot|sweet spot|w\/kg|wahoo|watts/],
  ['running', /\brun\b|running|vdot|daniels|threshold pace|critical speed|pace curve/],
  ['gym', /gym|strength|exercise|\blift\b|tempo|e1rm|dumbbell|barbell|reps/],
  ['stats', /benchmark|vo2|\btte\b|w′|season|power-duration|metric|\bstats\b|progress/],
  ['eat', /\beat\b|fuel|meal|recipe|nutrition|diet|calorie|protein|macro/],
  ['plan', /\bplan\b|calendar|schedule|horizon|plantoicu|reconcile|intervals event|mirror to intervals|check-in|checkin|readiness|freshness|energy score/],
  ['coach', /coach|chat|review|daily-adapt|adapt|notification|push|pregnan|cycle phase/],
  // recovery AFTER plan/coach — a Plan item that merely mentions "recovery" (e.g. #488) stays 'plan'; only a
  // dedicated recovery item (no plan/coach/stats keyword) lands here.
  ['recovery', /recovery|sauna|\bcold\b|massage|mobility|foam roll|breathwork/],
  ['admin', /backlog|road ?map|admin|deploy|ci\/cd|secret|promote|report button|triage/],
]
const areaOf = (title, summary) => {
  const s = `${title || ''} ${summary || ''}`.toLowerCase()
  for (const [area, re] of AREA_RULES) if (re.test(s)) return area
  return 'other'
}
// when it was logged (first date in the entry) — the timestamp shown on the item
const dateOf = (body) => { const m = body.match(/\b(20\d{2}-\d{2}-\d{2})\b/); return m ? m[1] : '' }
const clean = (s) => s
  .replace(/`([^`]+)`/g, '$1')       // strip code ticks
  .replace(/\*\*/g, '')              // bold
  .replace(/\[\[([^\]]+)\]\]/g, '$1')// wiki links
  .replace(/\s+/g, ' ')
  .trim()

const items = []
let cur = null
const unparsed = [] // item-looking lines (`NNN. `) that matched NEITHER head form — silent-drop guard
for (const line of md.split('\n')) {
  const m = line.match(HEAD)
  if (m) { if (cur) items.push(cur); cur = { n: Number(m[1]), status: statusOf(m[2]), title: m[3], body: m[4] || '', titleOpen: false }; continue }
  const mo = line.match(HEAD_OPEN) // title's **bold** opened here but didn't close on this line (#488)
  if (mo) { if (cur) items.push(cur); cur = { n: Number(mo[1]), status: statusOf(mo[2]), title: mo[3], body: '', titleOpen: true }; continue }
  if (/^\d+\.\s/.test(line)) unparsed.push(line.match(/^(\d+)/)[1]) // looks like an item, parsed as neither → would drop
  if (!cur) continue
  if (cur.titleOpen) { // still gathering a wrapped title, until its closing **
    const c = line.indexOf('**')
    if (c >= 0) { cur.title += ' ' + line.slice(0, c).trim(); cur.body += ' ' + line.slice(c + 2).trim(); cur.titleOpen = false }
    else cur.title += ' ' + line.trim()
  } else if (/^\s+\S/.test(line)) cur.body += ' ' + line.trim() // indented continuation
  else if (line.trim() !== '') { items.push(cur); cur = null } // a non-indented, non-item line ends it
}
if (cur) items.push(cur)
if (unparsed.length) console.warn(`build-backlog: ⚠ ${unparsed.length} item-looking line(s) parsed as NEITHER head form (bad ** or format) — check #${unparsed.join(' #')}`)

// de-dup by number (keep the last occurrence), newest first
const byN = new Map()
for (const it of items) {
  const body = clean(it.body)
  const title = clean(it.title)
  const summary = body.length > 280 ? body.slice(0, 277) + '…' : body
  byN.set(it.n, { n: it.n, status: it.status, title, summary, test: clean(testOf(it.body)), env: envLevel(it.status, it.body), date: dateOf(it.body), area: areaOf(title, body) })
}
const out = [...byN.values()].sort((a, b) => b.n - a.n)

mkdirSync(join(root, 'src/data/generated'), { recursive: true })
writeFileSync(join(root, 'src/data/generated/backlog.json'), JSON.stringify(out))
const by = (s) => out.filter((i) => i.status === s).length
console.log(`build-backlog: ${out.length} items → src/data/generated/backlog.json (${by('todo')} todo · ${by('totest')} to-test · ${by('done')} done)`)
