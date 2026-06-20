// Import TheMealDB (free recipe API) into our self-hosted pipeline.
// Fetches all meals (a–z), downloads each thumbnail locally (independence-gate
// safe), maps to our recipe schema with source:'themealdb', and writes
// downloaded_pages/themealdb_recipes.json for build-catalog to merge.
// Attribution required (TheMealDB) — commercial flagged CHECK in the manifest.
import { mkdirSync, existsSync, writeFileSync, createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DL = process.env.DOWNLOADED_PAGES_DIR || join(ROOT, 'downloaded_pages')
const IMG_DIR = join(DL, 'themealdb_images')
const API = 'https://www.themealdb.com/api/json/v1/1'
mkdirSync(IMG_DIR, { recursive: true })

const getJson = async (u) => { const r = await fetch(u, { headers: { 'user-agent': 'platyplus' } }); return r.ok ? r.json() : { meals: null } }
async function download(url, dest) {
  for (let a = 0; a < 3; a++) try {
    const r = await fetch(url); if (!r.ok) return r.status === 404 ? false : (a === 2 ? false : await new Promise((res) => setTimeout(() => res(false), 300)))
    await new Promise((res, rej) => { const w = createWriteStream(dest); Readable.fromWeb(r.body).pipe(w); w.on('finish', res); w.on('error', rej) }); return true
  } catch { if (a === 2) return false }
  return false
}

const CAT = (c) => { const x = (c || '').toLowerCase(); if (x === 'breakfast') return 'breakfast'; if (/dessert|side|starter/.test(x)) return 'snack'; return 'dinner' }
const clean = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
function mapMeal(m) {
  const ingredients = []
  for (let i = 1; i <= 20; i++) { const ing = (m[`strIngredient${i}`] || '').trim(); const me = (m[`strMeasure${i}`] || '').trim(); if (ing) ingredients.push(`${me} ${ing}`.trim()) }
  const steps = clean(m.strInstructions).split(/\r?\n|(?<=\.)\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s.length > 3)
  const tags = [m.strCategory, m.strArea, ...((m.strTags || '').split(',').map((t) => t.trim()).filter(Boolean))].filter(Boolean)
  const diet = []; if (/vegan/i.test(m.strCategory)) diet.push('vegan'); else if (/vegetarian/i.test(m.strCategory)) diet.push('vegetarian')
  return {
    id: 'tmdb-' + m.idMeal, title: m.strMeal, category: CAT(m.strCategory),
    minutes: 0, kcal: 0, protein: 0, carbs: 0, fat: 0,
    ingredients, steps, thumbnail: `/media/images/themealdb_images/${m.idMeal}.jpg`,
    tags, servings: 0, diet, source: 'themealdb',
  }
}

const seen = new Map()
for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
  const { meals } = await getJson(`${API}/search.php?f=${ch}`)
  for (const m of meals || []) if (!seen.has(m.idMeal)) seen.set(m.idMeal, m)
  process.stdout.write(`  ${ch}:${seen.size} `)
}
console.log(`\nthemealdb: ${seen.size} meals`)

let got = 0
const recipes = []
for (const m of seen.values()) {
  const dest = join(IMG_DIR, m.idMeal + '.jpg')
  if (!existsSync(dest) && m.strMealThumb) { if (await download(m.strMealThumb, dest)) got++ } else if (existsSync(dest)) got++
  recipes.push(mapMeal(m))
}
writeFileSync(join(DL, 'themealdb_recipes.json'), JSON.stringify(recipes))
console.log(`images: ${got} -> ${IMG_DIR}; recipes -> downloaded_pages/themealdb_recipes.json`)
