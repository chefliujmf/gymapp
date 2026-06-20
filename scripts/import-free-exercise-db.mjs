// Import yuhonas/free-exercise-db (public domain) into our self-hosted pipeline.
// Downloads the catalog JSON + each exercise's first demo image into
// downloaded_pages/ so build-catalog can emit them (independence-gate safe — we
// host the images ourselves). Resumable: skips images already on disk.
import { mkdirSync, existsSync, writeFileSync, createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DL = process.env.DOWNLOADED_PAGES_DIR || join(ROOT, 'downloaded_pages')
const IMG_DIR = join(DL, 'free_exercise_db_images')
const RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'
mkdirSync(IMG_DIR, { recursive: true })

const slug = (id) => id.replace(/[^A-Za-z0-9_-]/g, '_')

async function getJson() {
  const r = await fetch(`${RAW}/dist/exercises.json`)
  if (!r.ok) throw new Error('exercises.json ' + r.status)
  return r.json()
}
async function download(url, dest) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url)
      if (!r.ok) { if (r.status === 404) return false; throw new Error(String(r.status)) }
      await new Promise((res, rej) => { const w = createWriteStream(dest); Readable.fromWeb(r.body).pipe(w); w.on('finish', res); w.on('error', rej) })
      return true
    } catch (e) { if (a === 2) { console.warn('  fail', url, e.message); return false } }
  }
  return false
}
async function pool(items, n, fn) {
  let i = 0, done = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); if (++done % 100 === 0) console.log(`  ${done}/${items.length}`) }
  }))
}

const all = await getJson()
console.log(`free-exercise-db: ${all.length} exercises`)
writeFileSync(join(DL, 'free_exercise_db.json'), JSON.stringify(all))

let got = 0, miss = 0
await pool(all, 12, async (ex) => {
  const src = ex.images?.[0]
  if (!src) { miss++; return }
  const dest = join(IMG_DIR, slug(ex.id) + '.jpg')
  if (existsSync(dest)) { got++; return }
  const ok = await download(`${RAW}/exercises/${src}`, dest)
  ok ? got++ : miss++
})
console.log(`images: ${got} present, ${miss} missing -> ${IMG_DIR}`)
