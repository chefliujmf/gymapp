#!/usr/bin/env node
// The ONE reliable backlog tool (replaces ad-hoc ssh one-liners that created orphans, clobbered reviews, and
// miscounted). It mirrors src/pages/AdminBacklog.tsx EXACTLY so my numbers == what JM sees:
//   • merged = generated items (src/data/generated/backlog.json) + added items (reports/admin-adds), added→'todo'
//   • eff status = migrate(triage[n].status ?? item.status ?? 'todo');  'build'→'todo'
//   • open = eff ∉ {done, discarded};  type from triage[n].type (untyped ≠ bug in the Bug filter)
// GUARDS: only operate on REAL items (in merged); NEVER overwrite a status JM set (pass/fail/done) unless --force.
// Usage:
//   node scripts/backlog.mjs status                 # counts + totest (real) + the review reports queue
//   node scripts/backlog.mjs flip <n> totest "note" # guarded status flip (+ optional Claude note)
//   node scripts/backlog.mjs settype <n> <type>     # bug|feature|idea
//   node scripts/backlog.mjs done <n>               # pass→done (only if currently pass)
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GEN = JSON.parse(readFileSync(join(ROOT, 'src/data/generated/backlog.json'), 'utf8'))
const ITEMS = Array.isArray(GEN) ? GEN : (GEN.items || Object.values(GEN))
const mig = (s) => (s === 'build' ? 'todo' : s)
const DONE = new Set(['done', 'discarded'])
const REVIEWED = new Set(['pass', 'fail', 'done']) // JM's outcomes — protect from my writes
const SH = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })

function reconnect() { try { SH(`bash ${join(ROOT, 'scripts/ts-up.sh')} >/dev/null 2>&1`) } catch { /* ignore */ } }
function readBl() { reconnect(); return JSON.parse(SH(`ssh -o ConnectTimeout=15 xps 'docker exec gymapp cat /srv/backlog/backlog.json'`)) }
function writeBl(bl) {
  reconnect()
  const tmp = join(ROOT, '.secrets/.bl-out.json'); writeFileSync(tmp, JSON.stringify(bl))
  SH(`cat ${tmp} | ssh -o ConnectTimeout=15 xps 'docker exec -i gymapp sh -c "cat > /srv/backlog/.bl.tmp && mv /srv/backlog/.bl.tmp /srv/backlog/backlog.json"'`)
}

// merged view exactly like the app
function merged(bl) {
  const m = new Map()
  for (const it of ITEMS) m.set(String(it.n), { n: it.n, status: it.status, title: it.title, area: it.area, added: false })
  for (const a of (bl.added || [])) m.set(String(a.n), { n: a.n, status: 'todo', title: a.title, added: true, reporter: a.reporter })
  return m
}
const effOf = (bl, k, it) => mig((bl.triage[k] || {}).status ?? it.status ?? 'todo')
const isReal = (bl, k) => merged(bl).has(String(k))

function status(bl) {
  const m = merged(bl)
  let bg = 0, ft = 0, id = 0, untyped = 0
  const totest = [], reports = []
  for (const [k, it] of m) {
    const t = bl.triage[k] || {}, s = effOf(bl, k, it)
    if (s === 'totest') totest.push(k)
    if (s === 'review' && t.type === 'bug') reports.push({ n: k, title: (it.title || '').slice(0, 56) })
    if (DONE.has(s)) continue
    if (t.type === 'feature') ft++; else if (t.type === 'idea') id++; else if (t.type === 'bug') bg++; else untyped++
  }
  // ORPHANS: triage keys that aren't real items (the #412 class of bug)
  const orphans = Object.keys(bl.triage).filter((k) => !m.has(k))
  console.log(`OPEN → bugs:${bg} features:${ft} ideas:${id}${untyped ? ' untyped:' + untyped : ''}`)
  console.log(`TOTEST (real items only): ${totest.length}  [${totest.sort((a, b) => a - b).join(', ') || 'none'}]`)
  console.log(`REVIEW bug-reports to work (${reports.length}):`)
  for (const r of reports.sort((a, b) => a.n - b.n)) console.log(`  #${r.n}  ${r.title}`)
  if (orphans.length) console.log(`\n⚠️ ORPHAN triage keys (not real items — should be deleted): ${orphans.join(', ')}`)
  return { bg, ft, id, totest, reports, orphans }
}

const [cmd, n, arg2, note] = process.argv.slice(2)
const bl = readBl()
bl.triage = bl.triage || {}
if (cmd === 'status') { status(bl) }
else if (cmd === 'flip') {
  const k = String(n)
  if (!isReal(bl, k)) { console.error(`REFUSED: #${k} is not a real backlog item (orphan). No write.`); process.exit(1) }
  const cur = (bl.triage[k] || {}).status
  if (REVIEWED.has(cur) && !process.argv.includes('--force')) { console.error(`REFUSED: #${k} is '${cur}' (JM reviewed it). Not overwriting. Use --force only if intended.`); process.exit(1) }
  const t = bl.triage[k] || { comments: [] }; t.status = arg2; t.comments = t.comments || []
  if (note) t.comments.push({ text: note, at: Date.now(), by: 'claude' })
  bl.triage[k] = t; writeBl(bl); console.log(`#${k} → ${arg2}`)
}
else if (cmd === 'settype') {
  const k = String(n); if (!isReal(bl, k)) { console.error(`REFUSED: #${k} not a real item.`); process.exit(1) }
  const t = bl.triage[k] || { comments: [] }; t.type = arg2; bl.triage[k] = t; writeBl(bl); console.log(`#${k} type → ${arg2}`)
}
else if (cmd === 'done') {
  const k = String(n); const cur = (bl.triage[k] || {}).status
  if (cur !== 'pass') { console.error(`REFUSED: #${k} is '${cur}', not 'pass'. done only follows a pass.`); process.exit(1) }
  bl.triage[k].status = 'done'; writeBl(bl); console.log(`#${k} → done`)
}
else if (cmd === 'rmorphan') { const before = Object.keys(bl.triage).length; const m = merged(bl); for (const k of Object.keys(bl.triage)) if (!m.has(k)) delete bl.triage[k]; writeBl(bl); console.log(`removed ${before - Object.keys(bl.triage).length} orphan(s)`) }
else { console.log('cmds: status | flip <n> <status> [note] | settype <n> <type> | done <n> | rmorphan') }
