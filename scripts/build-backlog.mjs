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
const statusOf = (e) => (e.includes('✅') ? 'done' : e.includes('🔨') ? 'build' : 'todo') // ⬜/anything else → todo
const clean = (s) => s
  .replace(/`([^`]+)`/g, '$1')       // strip code ticks
  .replace(/\*\*/g, '')              // bold
  .replace(/\[\[([^\]]+)\]\]/g, '$1')// wiki links
  .replace(/\s+/g, ' ')
  .trim()

const items = []
let cur = null
for (const line of md.split('\n')) {
  const m = line.match(HEAD)
  if (m) { if (cur) items.push(cur); cur = { n: Number(m[1]), status: statusOf(m[2]), title: m[3], body: m[4] || '' } }
  else if (cur) {
    if (/^\s+\S/.test(line)) cur.body += ' ' + line.trim() // indented continuation
    else if (line.trim() !== '') { items.push(cur); cur = null } // a non-indented, non-item line ends it
  }
}
if (cur) items.push(cur)

// de-dup by number (keep the last occurrence), newest first
const byN = new Map()
for (const it of items) byN.set(it.n, { n: it.n, status: it.status, title: clean(it.title), summary: (() => { const b = clean(it.body); return b.length > 280 ? b.slice(0, 277) + '…' : b })() })
const out = [...byN.values()].sort((a, b) => b.n - a.n)

mkdirSync(join(root, 'src/data/generated'), { recursive: true })
writeFileSync(join(root, 'src/data/generated/backlog.json'), JSON.stringify(out))
const by = (s) => out.filter((i) => i.status === s).length
console.log(`build-backlog: ${out.length} items → src/data/generated/backlog.json (${by('todo')} todo · ${by('build')} building · ${by('done')} done)`)
