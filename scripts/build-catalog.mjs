#!/usr/bin/env node
// Build the app catalog from the collected source data:
//   Recipe  -> recipes.json
//   Workouts        -> workouts.json (gym, LiftLog-style)
//   Meditation       -> mind.json
//   JOIN cycling + running -> endurance.json (interval workouts)
//
// Source data is gitignored (personal, from the user's own subscriptions).
// Output goes to src/data/generated/ and is merged into the catalog.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DL = join(ROOT, 'downloaded_pages')
const JOIN_DIR = resolve(ROOT, '..', 'cyclingcoach', 'data', 'join', 'workouts')
const OUT = join(ROOT, 'src', 'data', 'generated')
mkdirSync(OUT, { recursive: true })

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const listJson = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')) : []

// slug -> Google Drive file id, for meditation audio hosted in the user's Drive.
const DRIVE_AUDIO_MAP = (() => {
  const p = join(__dirname, 'drive-audio-map.json')
  return existsSync(p) ? readJson(p) : {}
})()
const driveAudioUrl = (slug) =>
  DRIVE_AUDIO_MAP[slug]
    ? `https://drive.usercontent.google.com/download?id=${DRIVE_AUDIO_MAP[slug]}&export=download`
    : undefined

// filename -> Google Drive id for self-hosted exercise media (videos + MW posters).
const DRIVE_MEDIA_MAP = (() => {
  const p = join(__dirname, 'drive-media-map.json')
  return existsSync(p) ? readJson(p) : {}
})()
const mediaBase = (u) => { try { return decodeURIComponent(new URL(u).pathname.split('/').pop()) } catch { return String(u).split('/').pop() } }
/** Repoint a media URL at its Drive copy when we've self-hosted it. */
const driveMediaUrl = (url) => {
  if (!url) return url
  const id = DRIVE_MEDIA_MAP[mediaBase(url)]
  return id ? `https://drive.usercontent.google.com/download?id=${id}&export=download` : url
}

function pickImg(imageList) {
  if (!imageList) return undefined
  const order = ['landscapewidedesktop2x', 'landscape32medium2x', 'landscape32medium1x',
                 'landscape32small2x', 'landscapewidemobile1x', 'landscape32small1x']
  for (const k of order) if (imageList[k]?.url) return imageList[k].url
  for (const v of Object.values(imageList)) if (v?.url) return v.url
  return undefined
}

function pickExerciseImg(imageList) {
  if (!imageList) return undefined
  const order = ['landscapemobile2x', 'landscapedesktop2x', 'landmob', 'landdesk',
                 'landscapemobile1x', 'landscapedesktop1x', 'portmob']
  for (const k of order) if (imageList[k]?.url) return imageList[k].url
  for (const v of Object.values(imageList)) if (v?.url) return v.url
  return undefined
}

const num = (x) => (typeof x === 'number' ? Math.round(x) : 0)
const trimNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))

// Remove the source brand name from any user-facing text.
const stripBrand = (s) => String(s || '').replace(/\bCentr\b:?\s*/gi, '').trim()

// --- Recipes --------------------------------------------------------------
const MEAL_TAGS = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack' }
function mealCategory(r, isSnack) {
  if (isSnack) return 'snack'
  for (const t of r.tags || []) {
    const n = String(t.name || '').toLowerCase()
    if (MEAL_TAGS[n]) return MEAL_TAGS[n]
  }
  return 'dinner'
}
function fmtIngredient(i) {
  const q = i.quantity ? trimNum(i.quantity) : ''
  const unit = i.unit && i.unit !== 'whole' ? i.unit : ''
  return [q, unit, i.name].filter(Boolean).join(' ').trim()
}
function mapRecipe(d, isSnack) {
  const r = d?.result?.recipe
  if (!r || !r.title) return null
  return {
    id: 'r-' + (r.urlPartial || r.contentId),
    title: stripBrand(r.title),
    category: mealCategory(r, isSnack),
    minutes: num(r.prepTime) + num(r.cookTime),
    kcal: num(r.calories),
    protein: num(r.protein),
    carbs: num(r.carbs),
    fat: num(r.fat),
    ingredients: (r.ingredients || []).map(fmtIngredient).filter(Boolean),
    steps: (r.methods || []).map((m) => m.text).filter(Boolean),
    thumbnail: pickImg(r.imageList),
    tags: [...new Set((r.tags || []).map((t) => t.name).filter(Boolean))].slice(0, 8),
    servings: r.serves || undefined,
    diet: ['vegetarian'],
  }
}

// --- Gym workouts ---------------------------------------------------------
const humanize = (slug) =>
  String(slug || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
function workoutDiscipline(text) {
  const t = text.toLowerCase()
  if (/\byoga\b/.test(t)) return 'yoga'
  if (/pilates|barre/.test(t)) return 'pilates'
  if (/box(ing)?\b|kickbox/.test(t)) return 'boxing'
  if (/mobility|stretch|recovery|foam|flexibilit/.test(t)) return 'mobility'
  if (/hiit|tabata|circuit|metcon|conditioning|amrap|emom|burner/.test(t)) return 'hiit'
  if (/cardio|run\b|rower|row\b|sprint|cycle/.test(t)) return 'cardio'
  return 'strength'
}
function mapWorkout(d) {
  const rt = d?.result?.routine
  if (!rt) return null
  const set0 = (rt.sets || [])[0]
  const level = (set0?.levels || [])[0]
  const wk = (level?.workouts || [])[0]
  const title = stripBrand(rt.title || set0?.title || wk?.title || humanize(rt.urlPartial))
  if (!title) return null
  const discipline = workoutDiscipline(`${title} ${rt.summary || ''} ${set0?.title || ''}`)
  const exercises = (wk?.groups || []).flatMap((g) =>
    (g.exercises || []).map((e) => {
      const image = pickExerciseImg(e.imageList)
      const video = (e.media || []).map((m) => m.value).find((v) => String(v).toLowerCase().endsWith('.mp4'))
      return {
        name: e.title,
        prescription: e.durationInSeconds
          ? `${Math.round(e.durationInSeconds)}s`
          : e.reps ? `${e.reps} reps` : 'as prescribed',
        seconds: e.durationInSeconds || undefined,
        rest: e.rest || undefined,
        note: g.title || undefined,
        image,
        video: driveMediaUrl(video),
        // Only fall back to a MuscleWiki search link when we have no image.
        demoUrl: image ? undefined : (e.title ? 'https://musclewiki.com/exercises?search=' + encodeURIComponent(e.title) : undefined),
      }
    }),
  )
  // Skip video-led program shells with no structured exercises — they can't be
  // logged in the set-tracking flow and we don't host the source video.
  if (exercises.length === 0) return null
  // Duration: sum the exercises' work + rest time; some levels carry a bogus
  // tiny value, so take the larger of the two.
  const exSeconds = (wk?.groups || []).reduce(
    (s, g) => s + (g.exercises || []).reduce((ss, e) => ss + (e.durationInSeconds || 0) + (e.rest || 0), 0), 0)
  const durationMin = Math.round(Math.max(level?.durationInSeconds || 0, exSeconds) / 60)
  return {
    id: 'w-' + (rt.urlPartial || rt.contentId),
    title,
    discipline,
    duration: durationMin,
    level: 'intermediate',
    equipment: [],
    summary: stripBrand(rt.summary || ''),
    exercises,
    thumbnail: pickImg(set0?.imageList),
  }
}

// --- Mind / meditation ----------------------------------------------------
function mapMind(d) {
  const a = d?.result?.article
  if (!a || !a.title) return null
  const mp3 = (a.media || []).map((m) => m.value).find((v) => String(v).toLowerCase().endsWith('.mp3'))
  const t = a.title.toLowerCase()
  const kind = /sleep/.test(t) ? 'sleep' : /breath/.test(t) ? 'breathwork' : /focus/.test(t) ? 'focus' : 'meditation'
  const slug = a.urlPartial || String(a.contentId)
  return {
    id: 'm-' + (a.urlPartial || a.contentId),
    title: stripBrand(a.title),
    kind,
    duration: 0, // not provided by source; player reads it from the audio
    summary: stripBrand(a.summary || a.introText || ''),
    coach: (a.authors || []).map((x) => x.name).filter(Boolean).join(', ') || undefined,
    // Prefer the user's Drive copy; fall back to the source mp3.
    audioUrl: driveAudioUrl(slug) || mp3,
  }
}

// --- Endurance (JOIN cycling + running) -----------------------------------
function mapEndurance(d) {
  if (!d || !d.name) return null
  return {
    id: 'join-' + d.workoutId,
    name: d.name,
    sport: d.sportType || 'cycling',
    category: d.workoutCategoryName || 'Workout',
    duration: Math.round((d.duration || 0) / 60),
    intensity: d.intensity,
    stress: d.stress,
    description: d.description || '',
    thumbnail: d.imageUrl || undefined,
    blocks: (d.blocks || []).map((b) => ({
      numRepeats: b.numRepeats || 1,
      intervals: (b.intervals || []).map((iv) => ({
        duration: iv.duration,
        rawPower: iv.rawPower,
        power: iv.power,
        heartRate: iv.heartRate,
      })),
    })),
  }
}

// --- Exercise library -----------------------------------------------------
// The gym is really a library of exercises; the coach assembles workouts from
// them. equipment/targets come empty from the source, so derive a broad group
// from the name for filtering.
function categorize(name = '') {
  const n = name.toLowerCase()
  // Mobility / yoga / stretch / warm-up (check first — poses shouldn't fall through)
  if (/\b(stretch|mobility|foam roll|\broll\b|pose|prayer|happy baby|puppy|cobra|child|downward|upward dog|warrior|pigeon|cat.?cow|thread the needle|hip opener|thoracic|warm.?up|cool.?down|breath|swing|circle|reach|opener|swimmer|inchworm|walkout|good morning|scorpion|windmill|world.?s greatest|clamshell)\b/.test(n)) return 'Mobility'
  // Boxing / striking / plyo / conditioning → Cardio
  if (/\b(jumps?|jumping|jacks?|burpee|sprint|high knee|skater|shuttle|tuck|sprawl|mountain climber|hook|jab|cross|uppercut|punch|combo|elbow|kick|\brun\b|cardio|skip|pop ?squat|star)\b/.test(n)) return 'Cardio'
  // Push (specific raises so calf/leg raises don't get caught here)
  if (/\b(push.?up|press|chest|dip|tricep|pike|fly|overhead|(lateral|front|side|delt|shoulder|arm) raise)\b/.test(n)) return 'Push'
  // Pull
  if (/\b(row|pull|chin|lat|curl|bicep|face.?pull|reverse fly|pulldown|pull.?up)\b/.test(n)) return 'Pull'
  // Core
  if (/\b(plank|crunch|sit.?up|core|\bab\b|abs|oblique|hollow|leg raise|russian twist|bicycle|dead.?bug|bird.?dog|superman|crawl|v.?up|toe touch|flutter|scissor)\b/.test(n)) return 'Core'
  // Legs
  if (/\b(squat|lunge|glute|hip thrust|\bleg\b|calf|hamstring|quad|step.?up|deadlift|bridge|kickback|wall sit|thruster|split squat|\bhip\b|hinge)\b/.test(n)) return 'Legs'
  return 'Full body'
}

// MuscleWiki: map a primary muscle / equipment to our broad bucket.
const LEGS = /glute|quad|hamstring|calf|calves|adductor|abductor/i
const PUSH = /chest|tricep|pectoral|front shoulder|anterior delt|lateral delt|^shoulders$/i
const PULL = /lat|bicep|forearm|trap|rear shoulder|posterior delt|lower back|upper back/i
const CORE = /abdominal|oblique|\bcore\b/i
function mwCategory(e) {
  const equip = (e.category?.name || '').toLowerCase()
  if (/yoga|stretch|recovery|pilates/.test(equip)) return 'Mobility'
  if (/cardio/.test(equip)) return 'Cardio'
  const m = (e.muscles_primary || [])[0]?.name || ''
  if (LEGS.test(m)) return 'Legs'
  if (CORE.test(m)) return 'Core'
  if (PULL.test(m)) return 'Pull'
  if (PUSH.test(m)) return 'Push'
  const force = (e.force?.name || '').toLowerCase()
  if (force === 'pull') return 'Pull'
  if (force === 'push') return 'Push'
  return 'Full body'
}

function mapMuscleWiki(e) {
  const male = (e.male_images || [])[0] || {}
  const female = (e.female_images || [])[0] || {}
  const video = male.branded_video || female.branded_video
  if (!video) return null
  return {
    id: 'mw-' + e.slug,
    name: stripBrand(e.name),
    image: driveMediaUrl(male.og_image || female.og_image),
    video: driveMediaUrl(male.branded_video || undefined),
    imageFemale: driveMediaUrl(female.og_image || undefined),
    videoFemale: driveMediaUrl(female.branded_video || undefined),
    category: mwCategory(e),
    muscle: (e.muscles_primary || [])[0]?.name || undefined,
    equipment: e.category?.name || undefined,
    difficulty: e.difficulty?.name || undefined,
    source: 'musclewiki',
  }
}

/** MuscleWiki exercises not already present (by normalized name) in `have`. */
function muscleWikiExtras(have) {
  const p = join(DL, 'musclewiki.json')
  if (!existsSync(p)) return []
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const seen = new Set(have.map((e) => norm(e.name)))
  const out = []
  for (const e of readJson(p)) {
    const m = mapMuscleWiki(e)
    if (!m || seen.has(norm(m.name))) continue
    seen.add(norm(m.name))
    out.push(m)
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function extractExercises(files) {
  const byId = new Map()
  for (const f of files) {
    const rt = readJson(join(DL, 'workouts', f))?.result?.routine
    for (const s of rt?.sets || [])
      for (const lv of s.levels || [])
        for (const wk of lv.workouts || [])
          for (const g of wk.groups || [])
            for (const e of g.exercises || []) {
              const id = 'e-' + (e.contentId || e.title)
              if (!e.title || byId.has(id)) continue
              const image = pickExerciseImg(e.imageList)
              const video = (e.media || []).map((m) => m.value).find((v) => String(v).toLowerCase().endsWith('.mp4'))
              if (!image && !video) continue // need a demo to be useful
              byId.set(id, {
                id, name: stripBrand(e.title), image, video: driveMediaUrl(video),
                seconds: e.durationInSeconds || undefined,
                category: categorize(e.title),
              })
            }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// A metadata index for every exercise video file, so the opaque filenames in
// Drive (esp. Centr's jwplayer ids) never lose their meaning.
const fileBase = (u) => { try { return decodeURIComponent(new URL(u).pathname.split('/').pop()) } catch { return String(u).split('/').pop() } }
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
function writeVideoManifest(exs) {
  const rows = []
  for (const e of exs) {
    if (e.video) rows.push({ file: fileBase(e.video), exercise: e.name, source: e.source || 'centr', gender: e.source === 'musclewiki' ? 'male' : '', category: e.category, muscle: e.muscle || '', equipment: e.equipment || '' })
    if (e.videoFemale) rows.push({ file: fileBase(e.videoFemale), exercise: e.name, source: e.source || '', gender: 'female', category: e.category, muscle: e.muscle || '', equipment: e.equipment || '' })
  }
  const cols = ['file', 'exercise', 'source', 'gender', 'category', 'muscle', 'equipment']
  writeFileSync(join(__dirname, '..', 'video-manifest.json'), JSON.stringify(rows, null, 0))
  writeFileSync(join(__dirname, '..', 'video-manifest.csv'), [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n'))
  return rows.length
}

function build(name, items) {
  const clean = items.filter(Boolean)
  writeFileSync(join(OUT, name + '.json'), JSON.stringify(clean, null, 0))
  return clean.length
}

// --- Run ------------------------------------------------------------------
const recipes = [
  ...listJson(join(DL, 'recipes')).map((f) => mapRecipe(readJson(join(DL, 'recipes', f)), false)),
  ...listJson(join(DL, 'snacks')).map((f) => mapRecipe(readJson(join(DL, 'snacks', f)), true)),
]
const workoutFiles = listJson(join(DL, 'workouts'))
const workouts = workoutFiles.map((f) => mapWorkout(readJson(join(DL, 'workouts', f))))
const centrExercises = extractExercises(workoutFiles).map((e) => ({ ...e, source: 'centr' }))
// Add MuscleWiki exercises we don't already have from Centr (men + women videos).
const mwExtras = muscleWikiExtras(centrExercises)
const exercises = [...centrExercises, ...mwExtras].sort((a, b) => a.name.localeCompare(b.name))
const mind = listJson(join(DL, 'meditation')).map((f) => mapMind(readJson(join(DL, 'meditation', f))))
const endurance = listJson(JOIN_DIR).map((f) => mapEndurance(readJson(join(JOIN_DIR, f))))

console.log('recipes:   ', build('recipes', recipes))
console.log('workouts:  ', build('workouts', workouts))
console.log('exercises: ', build('exercises', exercises), `(centr ${centrExercises.length} + musclewiki ${mwExtras.length})`)
// Committed index so the cyclingcoach can pick exercises by id when building
// gym workouts to POST to intervals.icu (see GYM_API.md). id + name + facets.
writeFileSync(
  join(__dirname, '..', 'gym-exercise-index.json'),
  JSON.stringify(exercises.map((e) => ({ id: e.id, name: e.name, category: e.category, muscle: e.muscle, equipment: e.equipment })), null, 0),
)
console.log('exercise index -> gym-exercise-index.json')
console.log('video manifest:', writeVideoManifest(exercises), '-> video-manifest.json + .csv')
console.log('mind:      ', build('mind', mind))
console.log('endurance: ', build('endurance', endurance),
  `(cycling ${endurance.filter((e) => e?.sport === 'cycling').length}, running ${endurance.filter((e) => e?.sport === 'running').length})`)
console.log('written to', OUT)
