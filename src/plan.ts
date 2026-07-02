// Bridges intervals.icu plan events into gymapp execution. The fetched week is
// stashed so a detail page can read one by id; a gym event's markdown table is
// parsed into a playable session (media resolved from the library by name).
import { exercises as library, allExercisesById } from './data/catalog'
import { parseGymTable, parseGymWorkout, type IcuEvent, type Segment } from './intervals'
import { rpeIntensity } from './tss'

// --- coach plans pushed via the gymapp API (rich execution detail) -------
export interface CoachPlan {
  id: string
  date: string
  sport: 'gym' | 'ride' | 'run'
  title: string
  notes?: string
  ftp?: number
  segments?: Segment[]
  rounds?: number
  exercises?: Array<{ name: string; exId?: string; mode?: 'timed' | 'reps'; seconds?: number; sets?: number; reps?: number; weight?: number; rest?: number; tempo?: string; tip?: string }>
  icuEventId?: string // set when this plan mirrors an intervals.icu event
  origin?: 'platyplus' | 'icu'
  // Structured coaching (optional; coach-authored). Meals/mind are separate calendar
  // items joined by date; these are the plan-level strategy + cues.
  objective?: string
  cues?: string[]
  tip?: string // #284 whole-session tip (e.g. tempo / rest focus)
  success?: string
  recovery?: string
  fuel?: { why?: string; supplements?: string }
  mind?: { why?: string }
}

/** Fetch the account's coach-pushed plans for a date range (session-authed). */
export async function fetchGymPlans(from: string, to: string): Promise<CoachPlan[]> {
  try {
    const res = await fetch(`/auth/plans?from=${from}&to=${to}`, { credentials: 'same-origin' })
    return res.ok ? await res.json() : []
  } catch { return [] }
}

/** Mirror intervals.icu-origin planned workouts INTO Platyplus (Platyplus then owns
 * them). Platyplus-first + Platyplus-wins; intervals deletions drop the import. */
export async function syncIcuPlans(from: string, to: string): Promise<void> {
  try {
    await fetch('/auth/plans/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ from, to }) })
  } catch { /* best effort; UI still shows live intervals events */ }
}

/** Convert a coach gym plan into a playable session (media resolved from library). */
export function gymSessionFromPlan(p: CoachPlan): AdHocSession {
  const exercises: AdHocEx[] = []
  for (let r = 0; r < (p.rounds || 1); r++)
    for (const x of p.exercises || []) {
      const lib = resolveLib(x.exId, x.name)
      exercises.push({
        name: x.name, exId: lib?.id, image: lib?.image, video: lib?.video, imageFemale: lib?.imageFemale, videoFemale: lib?.videoFemale,
        mode: x.mode || 'reps', seconds: x.seconds || 0, rest: x.rest || 0, sets: x.sets || 3, reps: x.reps || 10,
        note: (x.mode || 'reps') === 'reps' ? `${x.sets || 3}×${x.reps || 10}` : undefined,
        tempo: x.tempo, tip: x.tip,
      })
    }
  return { workoutId: 'plan-' + p.id, title: p.title, exercises }
}

export function setPlanEvents(evs: IcuEvent[]) { sessionStorage.setItem('planEvents', JSON.stringify(evs)) }
export function getPlanEvent(id: string): IcuEvent | undefined {
  try { return (JSON.parse(sessionStorage.getItem('planEvents') || '[]') as IcuEvent[]).find((e) => String(e.id) === id) } catch { return undefined }
}

// Stash coach plans so /coach/:id can read one by id (mirrors planEvents).
export function setCoachPlans(plans: CoachPlan[]) { try { sessionStorage.setItem('coachPlans', JSON.stringify(plans)) } catch { /* quota */ } }
export function getCoachPlan(id: string): CoachPlan | undefined {
  try { return (JSON.parse(sessionStorage.getItem('coachPlans') || '[]') as CoachPlan[]).find((p) => p.id === id) } catch { return undefined }
}
/** #293 — the coach plan a completed activity fulfilled (match day, then sport) → link back to it. */
export function findCoachPlan(date: string, sport: string): CoachPlan | undefined {
  try {
    const plans = JSON.parse(sessionStorage.getItem('coachPlans') || '[]') as CoachPlan[]
    return plans.find((p) => p.date === date && p.sport === sport) || plans.find((p) => p.date === date)
  } catch { return undefined }
}

export interface AdHocEx {
  name: string; exId?: string; image?: string; video?: string; imageFemale?: string; videoFemale?: string
  mode: 'timed' | 'reps'; seconds: number; rest: number; sets: number; reps: number; note?: string
  tempo?: string; tip?: string // #284
}
export interface AdHocSession { workoutId: string; title: string; exercises: AdHocEx[]; intensity?: 'low' | 'moderate' | 'high' }

export function setGymSession(s: AdHocSession) { sessionStorage.setItem('gymSession', JSON.stringify(s)) }
export function getGymSession(): AdHocSession | null {
  try { return JSON.parse(sessionStorage.getItem('gymSession') || 'null') } catch { return null }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const firstNum = (s?: string) => { const m = (s || '').match(/\d+/); return m ? Number(m[0]) : undefined }
const lastNum = (s?: string) => { const m = (s || '').match(/\d+/g); return m ? Number(m[m.length - 1]) : 60 }

const STOP = new Set(['or', 'plus', 'and', 'the', 'a', 'an', 'with', 'to', 'of', 'for', 'machine', 'seated', 'standing'])
// #296: fold common singular/plural gym terms so "Biceps curl" matches "Bicep Curl" video entries.
const STEM: Record<string, string> = { biceps: 'bicep', triceps: 'tricep', abs: 'ab', calves: 'calf', flyes: 'fly', flies: 'fly', curls: 'curl', rows: 'row', raises: 'raise', presses: 'press', squats: 'squat', lunges: 'lunge', dips: 'dip', extensions: 'extension' }
const toks = (s: string) => norm(s).split(' ').filter((w) => w && !STOP.has(w)).map((w) => STEM[w] || w)

/** Match a coach exercise label ("Dumbbell bench press or machine chest press")
 * to the best library demo by significant-word overlap. */
export function matchExercise(name: string) { return findLib(name) }
function findLib(name: string) {
  // #296: drop parenthetical notes — "(or machine chest press)", "(both sides)", "(left)" — they
  // bloat the query tokens and break the video-swap (which needs the whole query inside one entry).
  const clean = name.replace(/\([^)]*\)/g, ' ')
  const want = toks(clean)
  if (!want.length) return undefined
  const wantSet = new Set(want)
  const nn = norm(clean)
  // #296: PASS 1 — find the correct movement. Old code gated on score>=2, so single-word lifts
  // (Squat, Deadlift, Plank, Pull-up) could never match → no demo at all. Score by token overlap
  // with a tightness guard so "squat" doesn't grab a 5-word combo on one shared word.
  let best: (typeof library)[number] | undefined
  let bestKey = -1
  for (const e of library) {
    const et = toks(e.name)
    let overlap = 0
    for (const w of et) if (wantSet.has(w)) overlap++
    if (overlap < 1) continue
    const coverWant = overlap / want.length      // how much of what the coach asked for is present
    const coverName = overlap / (et.length || 1)  // how tight the entry is (not padded with other moves)
    if (want.length === 1 ? coverName < 0.5 : coverWant < 0.5) continue
    const exact = norm(e.name) === nn ? 1 : 0
    const key = exact * 1e6 + overlap * 1000 + (coverWant + coverName) * 100 + (e.video ? 15 : 0) - et.length
    if (key > bestKey) { best = e; bestKey = key }
  }
  if (!best) return undefined
  // PASS 2 — prefer a VIDEO demo (JM: "make sure all exercises have a video"). If the correct match
  // is image-only, swap to the TIGHTEST video entry that fully CONTAINS the query (a qualified
  // variation of the SAME movement, e.g. "Romanian Deadlift" → "Band Romanian Deadlift").
  if (!best.video) {
    let vBest: (typeof library)[number] | undefined
    let vKey = -Infinity
    for (const e of library) {
      if (!e.video) continue
      const et = toks(e.name)
      if (!want.every((w) => et.includes(w))) continue // want ⊆ entry tokens
      // exact name, else fewest extra words; avoid COMPOUND/combo clips (a poor single-move demo)
      const key = (norm(e.name) === nn ? 1000 : 0) - et.length - (/[+/]|combo|complex|into|thru/i.test(e.name) ? 50 : 0)
      if (key > vKey) { vBest = e; vKey = key }
    }
    if (vBest) return vBest
    // #309 HARD RULE — never resolve to an entry with NO picture AND NO video. If `best` is media-less
    // (one of the ~49 blank library rows), swap to the tightest same-movement entry that HAS media
    // (image is fine — the rule is "no picture AND no video"). Only if none exists do we keep `best`.
    if (!best.image && !best.imageFemale && !best.videoFemale) {
      let mBest: (typeof library)[number] | undefined
      let mKey = -Infinity
      for (const e of library) {
        if (!hasMedia(e)) continue
        const et = toks(e.name)
        if (!want.every((w) => et.includes(w))) continue
        const key = (norm(e.name) === nn ? 1000 : 0) - et.length - (/[+/]|combo|complex|into|thru/i.test(e.name) ? 50 : 0) + (e.video ? 5 : 0)
        if (key > mKey) { mBest = e; mKey = key }
      }
      if (mBest) return mBest
    }
  }
  return best
}
/** Does a library entry carry ANY demo media (video/image, either sex)? #309: we never render a
 *  gym exercise with none — a blank tile reads as broken. */
function hasMedia(e?: { image?: string; video?: string; imageFemale?: string; videoFemale?: string }) {
  return !!(e && (e.video || e.image || e.videoFemale || e.imageFemale))
}
/** Resolve a coach exercise to a library entry, PREFERRING media. The coach may pass an exId that
 *  points at a media-less row (#309) — in that case fall back to a name match that has media. */
function resolveLib(exId: string | undefined, name: string) {
  const byId = exId ? allExercisesById[exId] : undefined
  if (byId && hasMedia(byId)) return byId
  const byName = findLib(name)
  if (byName && hasMedia(byName)) return byName
  return byId || byName // keep whatever id we have; UI shows a clean emoji when truly media-less
}

/** Build a playable gym session from a coach WeightTraining event.
 * Prefers the structured [gymapp] format (coach builds from the library, with
 * exercise ids → exact demo videos); falls back to the markdown Main Set table. */
export function gymSessionFromEvent(e: IcuEvent): AdHocSession {
  const spec = parseGymWorkout(e.description || '')
  if (spec) {
    const exercises: AdHocEx[] = []
    for (let r = 0; r < (spec.rounds || 1); r++)
      for (const x of spec.exercises) {
        const lib = resolveLib(x.exId, x.name)
        exercises.push({
          name: x.name, exId: lib?.id, image: lib?.image, video: lib?.video, imageFemale: lib?.imageFemale, videoFemale: lib?.videoFemale,
          mode: x.mode, seconds: x.work || 0, rest: x.rest || 0, sets: x.sets || 3, reps: x.reps || 10,
          note: x.mode === 'reps' ? `${x.sets}×${x.reps}` : undefined,
        })
      }
    return { workoutId: 'icu-' + e.id, title: e.name, exercises, intensity: rpeIntensity(e.description || '') }
  }
  // Current coach format: the markdown "Main Set" table.
  const exercises: AdHocEx[] = parseGymTable(e.description || '').map((r) => {
    const lib = resolveLib(undefined, r.exercise)
    return {
      name: r.exercise, exId: lib?.id, image: lib?.image, video: lib?.video, imageFemale: lib?.imageFemale, videoFemale: lib?.videoFemale,
      mode: 'reps', seconds: 0, rest: lastNum(r.rest), sets: r.sets || 3, reps: firstNum(r.reps) || 10, note: r.reps,
    }
  })
  return { workoutId: 'icu-' + e.id, title: e.name, exercises, intensity: rpeIntensity(e.description || '') }
}
