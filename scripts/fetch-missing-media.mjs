#!/usr/bin/env node
// B2: download the still-images the catalog references but we never had locally —
// Centr exercise stills (cdn.centr.com) and JOIN endurance thumbnails — so we can
// self-host them too and drop the last emoji placeholders. Idempotent (skips files
// already present). Polite fixed concurrency.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DL = join(ROOT, 'downloaded_pages')
const JOIN_DIR = resolve(ROOT, '..', 'cyclingcoach', 'data', 'join', 'workouts')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const listJson = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')) : [])
const mediaBase = (u) => { try { return decodeURIComponent(new URL(u).pathname.split('/').pop()) } catch { return String(u).split('/').pop() } }

function pickExerciseImg(imageList) {
  if (!imageList) return undefined
  const order = ['landscapemobile2x', 'landscapedesktop2x', 'landmob', 'landdesk', 'landscapemobile1x', 'landscapedesktop1x', 'portmob']
  for (const k of order) if (imageList[k]?.url) return imageList[k].url
  for (const v of Object.values(imageList)) if (v?.url) return v.url
  return undefined
}

// Collect download jobs: url -> { dir, file }
const jobs = new Map()
for (const f of listJson(join(DL, 'workouts'))) {
  const rt = readJson(join(DL, 'workouts', f))?.result?.routine
  for (const s of rt?.sets || []) for (const lv of s.levels || []) for (const wk of lv.workouts || []) for (const g of wk.groups || []) for (const e of g.exercises || []) {
    const url = pickExerciseImg(e.imageList)
    if (url && /cdn\.centr\.com/i.test(url)) jobs.set(url, { dir: 'centr_images', file: mediaBase(url) })
  }
}
for (const f of listJson(JOIN_DIR)) {
  const d = readJson(join(JOIN_DIR, f))
  if (d?.imageUrl && d?.workoutId) jobs.set(d.imageUrl, { dir: 'endurance_images', file: String(d.workoutId) + '.jpg' })
}

for (const d of ['centr_images', 'endurance_images']) mkdirSync(join(DL, d), { recursive: true })
const all = [...jobs.entries()].map(([url, t]) => ({ url, path: join(DL, t.dir, t.file) }))
const todo = all.filter((j) => !existsSync(j.path))
console.log(`${jobs.size} referenced, ${all.length - todo.length} already present, ${todo.length} to fetch`)

let ok = 0, fail = 0, i = 0
const CONC = 8
async function worker() {
  while (i < todo.length) {
    const j = todo[i++]
    try {
      const r = await fetch(j.url)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      writeFileSync(j.path, Buffer.from(await r.arrayBuffer()))
      if (++ok % 200 === 0) console.log(`  ${ok}/${todo.length}…`)
    } catch { fail++ }
  }
}
await Promise.all(Array.from({ length: CONC }, worker))
console.log(`DONE: ${ok} downloaded, ${fail} failed`)
