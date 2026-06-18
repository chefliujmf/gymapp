// intervals.icu bridge — reads the coach's plan (the source of truth) so the
// app can execute it. Read-only. Dev uses the /icu vite proxy; production will
// use a serverless function so the key stays server-side.
import { getSetting, setSetting } from './db'

const ICU = '/icu/api/v1'
const DEFAULT_ATHLETE = 'i28814'

export interface IcuStep {
  duration?: number
  power?: { start: number; end: number; units: string }
  reps?: number
  steps?: IcuStep[]
  text?: string
}

export interface IcuEvent {
  id: number
  /** coach's shared id — links this calendar event to a rich gymapp plan */
  external_id?: string
  start_date_local: string
  category: string // WORKOUT | TARGET | NOTE | ...
  type: string // Ride | VirtualRide | WeightTraining | Run | ...
  name: string
  description?: string
  moving_time?: number
  icu_training_load?: number
  workout_doc?: { steps?: IcuStep[] }
}

export async function getIcuConfig() {
  return {
    apiKey: await getSetting('icu_api_key'),
    athleteId: (await getSetting('icu_athlete_id')) || DEFAULT_ATHLETE,
    // When true, the key lives server-side (per-account) and the /icu proxy
    // injects it — the browser sends no Authorization but is still "connected".
    serverKey: (await getSetting('icu_server_key')) === '1',
  }
}
export async function setIcuConfig(apiKey: string, athleteId?: string) {
  await setSetting('icu_api_key', apiKey.trim())
  if (athleteId) await setSetting('icu_athlete_id', athleteId.trim())
}

/** Headers for an /icu call. Authorization is added only when a client-side key
 * exists; otherwise the server-side proxy injects the account's stored key. */
function icuHeaders(apiKey?: string, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json', ...extra }
  if (apiKey) h.Authorization = 'Basic ' + btoa('API_KEY:' + apiKey)
  return h
}

/** Read the athlete's cycling FTP from intervals.icu (source of truth). */
export async function fetchAthleteFtp(): Promise<number | undefined> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return undefined
  const res = await fetch(`${ICU}/athlete/${athleteId}`, { headers: icuHeaders(apiKey) })
  if (!res.ok) return undefined
  const a = await res.json()
  const ss = (a.sportSettings || []).find((s: { types?: string[] }) => (s.types || []).some((t) => /ride/i.test(t))) || (a.sportSettings || [])[0]
  return ss?.ftp ?? a.icu_ftp ?? undefined
}

export async function fetchEvents(oldest: string, newest: string): Promise<IcuEvent[]> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) throw new Error('NO_KEY')
  const res = await fetch(`${ICU}/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}`, { headers: icuHeaders(apiKey) })
  if (!res.ok) throw new Error(`ICU_${res.status}`)
  return res.json()
}

// --- writing the plan (mirror) -------------------------------------------

/** Create a planned event on the intervals.icu calendar. */
export async function createEvent(ev: Partial<IcuEvent> & { start_date_local: string }): Promise<IcuEvent> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) throw new Error('NO_KEY')
  const res = await fetch(`${ICU}/athlete/${athleteId}/events`, {
    method: 'POST',
    headers: icuHeaders(apiKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(ev),
  })
  if (!res.ok) throw new Error(`ICU_${res.status}`)
  return res.json()
}

// --- gym workout interchange format --------------------------------------
// A planned gym workout is encoded in the event description so that BOTH gymapp
// and the cyclingcoach can produce/consume it via the intervals.icu REST API.
// See GYM_API.md. Shape:
//
//   [gymapp] 3 rounds            (or "[gymapp:<templateId>] 3 rounds" for a local fast-path)
//   • Squat [e-12345] — 40s / 15s rest
//   • Lunge [e-67890] — 40s / 15s rest
//
// The [exId] is optional; when present it links to the exercise library
// (for the demo video/image). Names without an id still play (no video).

export interface GymExSpec {
  name: string
  exId?: string
  mode: 'timed' | 'reps'
  work?: number   // timed
  rest?: number
  sets?: number   // reps
  reps?: number
  weight?: number
}
export interface GymWorkoutSpec {
  templateId?: number
  rounds: number
  exercises: GymExSpec[]
}

function encodeBody(e: GymExSpec): string {
  if (e.mode === 'reps') return `${e.sets}×${e.reps}${e.weight ? ` @ ${e.weight}kg` : ''}${e.rest ? ` / ${e.rest}s rest` : ''}`
  return `${e.work}s${e.rest ? ` / ${e.rest}s rest` : ''}`
}

export function encodeGymWorkout(spec: GymWorkoutSpec): string {
  const tag = spec.templateId != null ? `[gymapp:${spec.templateId}]` : '[gymapp]'
  const head = `${tag}${spec.rounds > 1 ? ` ${spec.rounds} rounds` : ''}`
  const lines = spec.exercises.map((e) => `• ${e.name}${e.exId ? ` [${e.exId}]` : ''} — ${encodeBody(e)}`)
  return [head, ...lines].join('\n')
}

const HEAD_RE = /^[•\-*]\s*(.+?)\s*(?:\[([^\]]+)\])?\s*[—–-]\s*(.+)$/
const REPS_RE = /^(\d+)\s*[×x]\s*(\d+)(?:\s*@\s*([\d.]+)\s*(?:kg|lb)?)?(?:\s*\/\s*(\d+)\s*s)?/i
const TIMED_RE = /^(\d+)\s*s(?:\s*\/\s*(\d+)\s*s)?/i

export function parseGymWorkout(description = ''): GymWorkoutSpec | null {
  const head = description.match(/\[gymapp(?::(\d+))?\](?:\s+(\d+)\s+rounds?)?/i)
  if (!head) return null
  const exercises: GymExSpec[] = []
  for (const raw of description.split('\n')) {
    const m = raw.match(HEAD_RE)
    if (!m) continue
    const name = m[1].trim(); const exId = m[2]?.trim(); const body = m[3].trim()
    const r = body.match(REPS_RE)
    if (r) { exercises.push({ mode: 'reps', name, exId, sets: +r[1], reps: +r[2], weight: r[3] ? +r[3] : undefined, rest: +(r[4] || 0) }); continue }
    const t = body.match(TIMED_RE)
    if (t) exercises.push({ mode: 'timed', name, exId, work: +t[1], rest: +(t[2] || 0) })
  }
  if (!exercises.length) return null
  return { templateId: head[1] ? Number(head[1]) : undefined, rounds: Number(head[2] || 1), exercises }
}

/** Push a built gym workout onto a day. Round-trips via parseGymWorkout. */
export async function scheduleGymWorkout(
  date: string, name: string, templateId: number,
  exercises: { name: string; exId?: string; mode?: 'timed' | 'reps'; seconds: number; rest: number; sets?: number; reps?: number; weight?: number }[],
  rounds: number,
) {
  const description = encodeGymWorkout({
    templateId, rounds,
    exercises: exercises.map((e): GymExSpec => e.mode === 'reps'
      ? { name: e.name, exId: e.exId, mode: 'reps', sets: e.sets, reps: e.reps, weight: e.weight, rest: e.rest }
      : { name: e.name, exId: e.exId, mode: 'timed', work: e.seconds, rest: e.rest }),
  })
  return createEvent({ start_date_local: `${date}T00:00:00`, category: 'WORKOUT', type: 'WeightTraining', name, description })
}

/** The gymapp template id embedded in a planned gym event, if any. */
export function gymTemplateId(e: IcuEvent): number | undefined {
  const m = (e.description || '').match(/\[gymapp:(\d+)\]/)
  return m ? Number(m[1]) : undefined
}

// --- normalization --------------------------------------------------------

/** A flattened player segment: ramps from powerStart% to powerEnd% of FTP. */
export interface Segment { duration: number; powerStart: number; powerEnd: number; label?: string; hr?: string }

/** Flatten workout_doc steps, expanding repeat blocks, into player segments. */
export function flattenIcuSteps(steps: IcuStep[] = []): Segment[] {
  const out: Segment[] = []
  const walk = (s: IcuStep) => {
    if (s.steps && s.reps) {
      for (let i = 0; i < s.reps; i++) s.steps!.forEach(walk)
    } else if (s.steps) {
      s.steps.forEach(walk)
    } else if (s.duration) {
      const p = s.power
      out.push({ duration: s.duration, powerStart: p?.start ?? 0, powerEnd: p?.end ?? 0 })
    }
  }
  steps.forEach(walk)
  return out
}

export interface NutritionRec { name: string; url?: string }
/** Pull "recipe: <name>, <url>" recommendations out of the event description. */
export function parseNutrition(description = ''): NutritionRec[] {
  const recs: NutritionRec[] = []
  for (const line of description.split('\n')) {
    if (!/recipe/i.test(line)) continue
    const m = line.match(/recipe:\s*([^,]+?)(?:\s*,\s*(https?:\/\/\S+))?\s*$/i)
    if (m) recs.push({ name: m[1].trim().replace(/\bCentr\b:?\s*/gi, '').trim(), url: m[2] })
  }
  return recs
}

/** First "Objective: …" line from a coach event description. */
export function eventObjective(e: IcuEvent): string | undefined {
  const m = (e.description || '').match(/Objective:\s*(.+)/i)
  return m ? m[1].trim() : undefined
}

export interface GymTableRow { type: string; exercise: string; cue?: string; sets?: number; reps?: string; rest?: string }

/** Parse the coach's "## Main Set" markdown table into exercise rows. */
export function parseGymTable(description = ''): GymTableRow[] {
  const lines = description.split('\n')
  const start = lines.findIndex((l) => /^##\s*Main Set/i.test(l))
  if (start < 0) return []
  const rows: GymTableRow[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l.startsWith('##')) break
    if (!l.startsWith('|')) continue
    const cells = l.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 4 || /^[-:\s]+$/.test(cells.join('')) || /exercise type/i.test(cells[0])) continue
    const [type, exercise, sets, reps, rest] = cells
    const dot = exercise.indexOf('.')
    rows.push({
      type,
      exercise: dot > 0 ? exercise.slice(0, dot).trim() : exercise,
      cue: dot > 0 ? exercise.slice(dot + 1).trim() : undefined,
      sets: Number(sets) || undefined, reps, rest,
    })
  }
  return rows
}

export const isExecutable = (e: IcuEvent) => e.category === 'WORKOUT'
export function sportOf(e: IcuEvent): 'cycling' | 'gym' | 'other' {
  if (e.type === 'Ride' || e.type === 'VirtualRide') return 'cycling'
  if (e.type === 'WeightTraining') return 'gym'
  return 'other'
}
