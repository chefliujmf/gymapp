// Bridges intervals.icu plan events into gymapp execution. The fetched week is
// stashed so a detail page can read one by id; a gym event's markdown table is
// parsed into a playable session (media resolved from the library by name).
import { exercises as library, allExercisesById } from './data/catalog'
import { parseGymTable, parseGymWorkout, type IcuEvent } from './intervals'

export function setPlanEvents(evs: IcuEvent[]) { sessionStorage.setItem('planEvents', JSON.stringify(evs)) }
export function getPlanEvent(id: string): IcuEvent | undefined {
  try { return (JSON.parse(sessionStorage.getItem('planEvents') || '[]') as IcuEvent[]).find((e) => String(e.id) === id) } catch { return undefined }
}

export interface AdHocEx {
  name: string; exId?: string; image?: string; video?: string; imageFemale?: string; videoFemale?: string
  mode: 'timed' | 'reps'; seconds: number; rest: number; sets: number; reps: number; note?: string
}
export interface AdHocSession { workoutId: string; title: string; exercises: AdHocEx[] }

export function setGymSession(s: AdHocSession) { sessionStorage.setItem('gymSession', JSON.stringify(s)) }
export function getGymSession(): AdHocSession | null {
  try { return JSON.parse(sessionStorage.getItem('gymSession') || 'null') } catch { return null }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const firstNum = (s?: string) => { const m = (s || '').match(/\d+/); return m ? Number(m[0]) : undefined }
const lastNum = (s?: string) => { const m = (s || '').match(/\d+/g); return m ? Number(m[m.length - 1]) : 60 }

const STOP = new Set(['or', 'plus', 'and', 'the', 'a', 'an', 'with', 'to', 'of', 'for', 'machine', 'seated', 'standing'])
const toks = (s: string) => norm(s).split(' ').filter((w) => w && !STOP.has(w))

/** Match a coach exercise label ("Dumbbell bench press or machine chest press")
 * to the best library demo by significant-word overlap. */
function findLib(name: string) {
  const want = toks(name)
  if (!want.length) return undefined
  let best: (typeof library)[number] | undefined
  let bestScore = 0
  for (const e of library) {
    const lt = new Set(toks(e.name))
    let sc = 0
    for (const w of want) if (lt.has(w)) sc++
    // Prefer higher overlap; tie-break to the more specific (shorter) name.
    if (sc > bestScore || (sc === bestScore && sc > 0 && best && e.name.length < best.name.length)) { best = e; bestScore = sc }
  }
  return bestScore >= 2 ? best : undefined
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
        const lib = (x.exId && allExercisesById[x.exId]) || findLib(x.name)
        exercises.push({
          name: x.name, exId: lib?.id, image: lib?.image, video: lib?.video, imageFemale: lib?.imageFemale, videoFemale: lib?.videoFemale,
          mode: x.mode, seconds: x.work || 0, rest: x.rest || 0, sets: x.sets || 3, reps: x.reps || 10,
          note: x.mode === 'reps' ? `${x.sets}×${x.reps}` : undefined,
        })
      }
    return { workoutId: 'icu-' + e.id, title: e.name, exercises }
  }
  // Current coach format: the markdown "Main Set" table.
  const exercises: AdHocEx[] = parseGymTable(e.description || '').map((r) => {
    const lib = findLib(r.exercise)
    return {
      name: r.exercise, exId: lib?.id, image: lib?.image, video: lib?.video, imageFemale: lib?.imageFemale, videoFemale: lib?.videoFemale,
      mode: 'reps', seconds: 0, rest: lastNum(r.rest), sets: r.sets || 3, reps: firstNum(r.reps) || 10, note: r.reps,
    }
  })
  return { workoutId: 'icu-' + e.id, title: e.name, exercises }
}
