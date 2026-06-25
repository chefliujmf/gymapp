// intervals.icu bridge — reads the coach's plan (the source of truth) so the
// app can execute it. Read-only. Dev uses the /icu vite proxy; production will
// use a serverless function so the key stays server-side.
import { getSetting, setSetting } from './db'

const ICU = '/icu/api/v1'
const DEFAULT_ATHLETE = 'i28814'

export interface IcuStep {
  duration?: number
  // intervals expresses power as a ramp {start,end} OR a steady {value} (%FTP) — both occur
  power?: { start?: number; end?: number; value?: number; units?: string }
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

/** A mean-max power curve (best watts sustainable for each duration). */
export interface PowerCurve { secs: number[]; watts: number[] }
/** Athlete mean-max POWER curve from intervals.icu over the last N days (cycling).
 * Read-only; null on no key/error/unexpected shape (graceful). */
export async function fetchPowerCurve(days: number): Promise<PowerCurve | null> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return null
  try {
    const res = await fetch(`${ICU}/athlete/${athleteId}/power-curves?curves=${days}d&type=Ride`, { headers: icuHeaders(apiKey) })
    if (!res.ok) return null
    const data = await res.json()
    // Tolerate a couple of shapes: { secs, list:[{ values|watts }] } or { secs, watts }.
    const list = data?.list || (Array.isArray(data) ? data : null)
    const curve = list ? list[0] : data
    const secs: number[] = curve?.secs || data?.secs || []
    const watts: number[] = curve?.values || curve?.watts || []
    if (!secs.length || !watts.length) return null
    return { secs, watts }
  } catch { return null }
}

/** A day of intervals.icu wellness/fitness (for the Fitness/trends page). */
export interface IcuWellness {
  date: string // YYYY-MM-DD
  fitness: number | null // CTL
  fatigue: number | null // ATL
  form: number | null // CTL - ATL
  load: number | null // daily training load (TSS)
  eftp: number | null
  weight: number | null
  restingHR: number | null
  hrv: number | null
  sleepHours: number | null
  sleepScore: number | null // 0-100 from a sleep tracker (Garmin/Oura/…), when present
}
/** Recent wellness/fitness series from intervals.icu (read-only). Empty on no key/error. */
export async function fetchWellness(oldest: string, newest: string): Promise<IcuWellness[]> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return []
  try {
    const res = await fetch(`${ICU}/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`, { headers: icuHeaders(apiKey) })
    if (!res.ok) return []
    const rows = await res.json()
    return (Array.isArray(rows) ? rows : []).map((d: Record<string, number>) => ({
      date: String(d.id),
      fitness: d.ctl ?? null, fatigue: d.atl ?? null,
      form: d.ctl != null && d.atl != null ? Math.round((d.ctl - d.atl) * 10) / 10 : null,
      load: d.ctlLoad ?? d.atlLoad ?? null, eftp: d.eftp ?? (d as Record<string, number>).icu_eftp ?? null,
      weight: d.weight ?? null, restingHR: d.restingHR ?? null,
      hrv: d.hrv ?? d.hrvSDNN ?? null, sleepHours: d.sleepSecs ? Math.round((d.sleepSecs / 3600) * 10) / 10 : null,
      sleepScore: d.sleepScore ?? null,
    }))
  } catch { return [] }
}

/** Athlete sex from intervals.icu ('male' | 'female' | undefined) — Platyplus doesn't
 * ask for it; the coaching engine gates the female module on this. */
export async function fetchAthleteSex(): Promise<string | undefined> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return undefined
  try {
    const res = await fetch(`${ICU}/athlete/${athleteId}`, { headers: icuHeaders(apiKey) })
    if (!res.ok) return undefined
    const a = await res.json()
    const s = String(a.sex || '').toLowerCase()
    return s === 'm' ? 'male' : s === 'f' ? 'female' : (s || undefined)
  } catch { return undefined }
}

export async function fetchEvents(oldest: string, newest: string): Promise<IcuEvent[]> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) throw new Error('NO_KEY')
  const res = await fetch(`${ICU}/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}`, { headers: icuHeaders(apiKey) })
  if (!res.ok) throw new Error(`ICU_${res.status}`)
  return cleanEvents(await res.json())
}

/** A COMPLETED activity (what you actually did) from intervals.icu. */
export interface IcuActivity {
  id: string
  start_date_local: string
  type: string // Ride | VirtualRide | Run | VirtualRun | WeightTraining | ...
  name?: string
  moving_time?: number
  distance?: number // metres
  total_elevation_gain?: number // metres climbed
  icu_average_watts?: number
  average_heartrate?: number
  icu_training_load?: number // TSS
  icu_intensity?: number // IF
  trainer?: boolean
  icu_rpe?: number // 1-10
  feel?: number // 1-5
  strava_id?: number | string // set when the activity is linked to Strava
}
/** Completed activities in a window (read-only). Empty on no key / error. */
export async function fetchActivities(oldest: string, newest: string): Promise<IcuActivity[]> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return []
  try {
    const res = await fetch(`${ICU}/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`, { headers: icuHeaders(apiKey) })
    return res.ok ? await res.json() : []
  } catch { return [] }
}
/** A single completed activity by id (summary). Null on no key / error. (#51) */
export async function fetchActivity(id: string | number): Promise<IcuActivity | null> {
  const { apiKey, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return null
  try {
    const res = await fetch(`${ICU}/activity/${id}`, { headers: icuHeaders(apiKey) })
    return res.ok ? await res.json() : null
  } catch { return null }
}
/** Per-sample streams of an activity from intervals (GPS + power/HR/altitude/cadence
 *  over time). Empty on no key / error. Powers the post-workout map (#51) + the
 *  timeline analytics (#54). */
export interface ActivityStreams { time?: number[]; watts?: (number | null)[]; heartrate?: (number | null)[]; altitude?: (number | null)[]; cadence?: (number | null)[]; latlng?: [number, number][] }
export async function fetchActivityStreams(id: string | number, types: string[] = ['latlng', 'time', 'watts', 'heartrate', 'altitude', 'cadence']): Promise<ActivityStreams> {
  const { apiKey, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return {}
  try {
    const res = await fetch(`${ICU}/activity/${id}/streams?types=${types.join(',')}`, { headers: icuHeaders(apiKey) })
    if (!res.ok) return {}
    const arr = await res.json()
    const out: Record<string, unknown> = {}
    if (Array.isArray(arr)) for (const s of arr) if (s?.type && Array.isArray(s.data)) out[s.type] = s.data
    return out as ActivityStreams
  } catch { return {} }
}
export const cleanLatLng = (t?: [number, number][]) => (t || []).filter((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
export const sportOfActivity = (a: IcuActivity) => (/run/i.test(a.type) ? 'run' : /ride|cycl/i.test(a.type) ? 'ride' : 'gym')
/** Indoor = trainer/virtual; otherwise outdoor (only meaningful for ride/run). */
export const isIndoorActivity = (a: IcuActivity) => a.trainer === true || /virtual/i.test(a.type || '')

// intervals.icu writes more than executable sessions — the ATP/annual plan, load
// targets, notes, fitness-days, etc. are REPRESENTATIONS, not things to do, so
// they should never show as a workout. Also collapse duplicate same-day rides
// (the sync surfaces several where the coach meant one) to a single canonical one.
const NON_EXECUTABLE = new Set(['NOTE', 'TARGET', 'SEASON_START', 'FITNESS_DAYS', 'SET_EFTP', 'HOLIDAY', 'SICK', 'INJURED', 'ATP', 'GOAL'])
export function isExecutableEvent(e: IcuEvent): boolean {
  if (/^ATP\b/i.test(e.name || '')) return false           // "ATP ..." annual-plan rows
  return !NON_EXECUTABLE.has(String(e.category || '').toUpperCase())
}
/** Higher = more canonical: prefer the coach's linked/structured ride when collapsing dupes. */
function rideRank(e: IcuEvent): number {
  return (e.external_id ? 4 : 0) + ((e.workout_doc?.steps?.length ?? 0) ? 2 : 0) + (/\[gymapp\]/i.test(e.description || '') ? 1 : 0) + Math.min(0.9, (e.moving_time || 0) / 1e6)
}
export function cleanEvents(events: IcuEvent[]): IcuEvent[] {
  const out: IcuEvent[] = []
  const bestRidePerDay = new Map<string, IcuEvent>()
  for (const e of events) {
    if (!isExecutableEvent(e)) continue
    if (sportOf(e) === 'cycling') {
      const day = e.start_date_local.slice(0, 10)
      const cur = bestRidePerDay.get(day)
      if (!cur || rideRank(e) > rideRank(cur)) bestRidePerDay.set(day, e)
    } else out.push(e)
  }
  return [...out, ...bestRidePerDay.values()]
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

/** Delete a planned event from the intervals.icu calendar (the coach's source
 * of truth). Used by the calendar's Remove/Substitute on intervals entries. */
export async function deleteEvent(id: number): Promise<void> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) throw new Error('NO_KEY')
  const res = await fetch(`${ICU}/athlete/${athleteId}/events/${id}`, {
    method: 'DELETE',
    headers: icuHeaders(apiKey),
  })
  if (!res.ok) throw new Error(`ICU_${res.status}`)
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

// One exercise segment: "Name [id] — body". Leading bullet optional (it's the
// split delimiter); the " — " separator must be space-padded so a hyphen inside
// a name (e.g. "Push-up") isn't mistaken for it.
const SEG_RE = /^[•·\-*]?\s*(.+?)\s*(?:\[([^\]]+)\])?\s+[—–-]\s+(.+)$/
const REPS_RE = /^(\d+)\s*[×x]\s*(\d+)(?:\s*@\s*([\d.]+)\s*(?:kg|lb)?)?(?:\s*\/\s*(\d+)\s*s)?/i
const TIMED_RE = /^(\d+)\s*s(?:\s*\/\s*(\d+)\s*s)?/i

export function parseGymWorkout(description = ''): GymWorkoutSpec | null {
  const head = description.match(/\[gymapp(?::(\d+))?\](?:\s+(\d+)\s+rounds?)?/i)
  if (!head) return null
  // Exercises may be newline-separated (one "• …" per line) OR all on one line
  // separated by bullets ("… • … • …"). Drop the header, then split on both.
  const body = description.slice((head.index ?? 0) + head[0].length)
  const exercises: GymExSpec[] = []
  for (const raw of body.split(/[•·\n]+/)) {
    const seg = raw.trim()
    if (!seg) continue
    const m = seg.match(SEG_RE)
    if (!m) continue
    const name = m[1].trim(); const exId = m[2]?.trim(); const b = m[3].trim()
    const r = b.match(REPS_RE)
    if (r) { exercises.push({ mode: 'reps', name, exId, sets: +r[1], reps: +r[2], weight: r[3] ? +r[3] : undefined, rest: +(r[4] || 0) }); continue }
    const t = b.match(TIMED_RE)
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
      // steady steps carry {value}; ramps carry {start,end}. Fall back to value so a
      // steady effort isn't flattened to 0 (#72 flat-blue) and warmups render (#107).
      const p = s.power
      out.push({ duration: s.duration, powerStart: p?.start ?? p?.value ?? 0, powerEnd: p?.end ?? p?.value ?? 0 })
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
