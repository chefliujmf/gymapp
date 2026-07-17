// intervals.icu bridge — reads the coach's plan (the source of truth) so the
// app can execute it. Read-only. Dev uses the /icu vite proxy; production will
// use a serverless function so the key stays server-side.
import { getSetting, setSetting } from './db'
import { ICU_FIELDS, RUN_FIELDS, ICU_FIELD_CODES, FEEL_LABELS } from './icu-fields'
import { seasonSpecs, daysSinceJan1, POWER_DURATIONS, PACE_DISTANCES, bestAt, paceOkay, type SeasonSpec } from './season-compare'

const ICU = '/icu/api/v1'
const DEFAULT_ATHLETE = 'i28814'

export interface IcuStep {
  duration?: number
  // intervals expresses power as a ramp {start,end} OR a steady {value} (%FTP) — both occur
  power?: { start?: number; end?: number; value?: number; units?: string }
  // runs target PACE (% of threshold pace) instead of power (#312) — same shape, different key
  pace?: { start?: number; end?: number; value?: number; units?: string }
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
export interface PowerCurve { secs: number[]; watts: number[]; cp?: number; wPrime?: number; r2?: number; eftp?: number } // #401/#403 CP/W′ + fit quality (FFT/Morton model) · #508 eFTP straight from the power model (the real current one; the wellness/sportInfo eFTP lags)
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
    const pm = (curve?.powerModels || []).find((m: { type?: string }) => m.type === 'FFT_CURVES') || (curve?.powerModels || [])[0]
    return { secs, watts, cp: pm?.criticalPower, wPrime: pm?.wPrime, r2: pm?.r2, eftp: pm?.ftp != null ? Math.round(pm.ftp) : undefined }
  } catch { return null }
}

export interface PaceCurve { secs: number[]; pace: number[]; dist: number[]; cs?: number; dPrime?: number; r2?: number } // #401/#403 CS/D′ + fit quality
/** Running mean-max PACE curve from intervals.icu (#396). intervals indexes it by DISTANCE
 * (`distance[]` m + `values[]` = seconds to cover each), so we derive duration + pace(sec/km) and
 * sort by duration to mirror the cycling power curve. Read-only; null on no key/error/empty. */
export async function fetchPaceCurve(days: number): Promise<PaceCurve | null> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return null
  try {
    const res = await fetch(`${ICU}/athlete/${athleteId}/pace-curves?curves=${days}d&type=Run`, { headers: icuHeaders(apiKey) })
    if (!res.ok) return null
    const data = await res.json()
    const curve = data?.list?.[0] || (Array.isArray(data) ? data[0] : data)
    const dist: number[] = curve?.distance || [], val: number[] = curve?.values || []
    if (!dist.length || !val.length) return null
    // point per bucket: duration = time to cover the distance, pace = sec/km. Sort by duration; dedupe (keep fastest).
    const pts = [] as { s: number; p: number; d: number }[]
    for (let i = 0; i < dist.length; i++) if (dist[i] > 0 && val[i] > 0) pts.push({ s: Math.round(val[i]), p: Math.round((val[i] / dist[i]) * 1000), d: dist[i] })
    pts.sort((a, b) => a.s - b.s)
    const secs: number[] = [], pace: number[] = [], dm: number[] = []
    for (const pt of pts) {
      if (secs.length && pt.s === secs[secs.length - 1]) { if (pt.p < pace[pace.length - 1]) { pace[pace.length - 1] = pt.p; dm[dm.length - 1] = pt.d } }
      else { secs.push(pt.s); pace.push(pt.p); dm.push(pt.d) }
    }
    const pmodel = (curve?.paceModels || [])[0]
    return secs.length >= 2 ? { secs, pace, dist: dm, cs: pmodel?.criticalSpeed, dPrime: pmodel?.dPrime, r2: pmodel?.r2 } : null
  } catch { return null }
}
// #403 — Efficiency Factor trend. intervals computes EF per activity (icu_efficiency_factor = NP÷HR for a
// ride, NGP-speed÷HR for a run) — a rising EF = your aerobic engine improving even when FTP/pace is flat.
export interface EfPoint { date: string; ef: number }
export interface EfTrend { points: EfPoint[]; latest: number | null; trend: 'up' | 'down' | 'flat' | null; deltaPct: number | null }
export async function fetchEfTrend(type: 'Ride' | 'Run', days = 90): Promise<EfTrend | null> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return null
  try {
    const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const res = await fetch(`${ICU}/athlete/${athleteId}/activities?oldest=${from}&newest=${to}`, { headers: icuHeaders(apiKey) })
    if (!res.ok) return null
    const arr = await res.json()
    const points: EfPoint[] = (Array.isArray(arr) ? arr : [])
      .filter((a: Record<string, number | string>) => a.type === type && Number(a.icu_efficiency_factor) > 0 && Number(a.moving_time) >= 1200) // ≥20 min → a meaningful aerobic EF
      .map((a: Record<string, number | string>) => ({ date: String(a.start_date_local || '').slice(0, 10), ef: Math.round(Number(a.icu_efficiency_factor) * 1000) / 1000 }))
      .filter((p) => p.date)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (points.length < 2) return { points, latest: points.length ? points[points.length - 1].ef : null, trend: null, deltaPct: null }
    const h = Math.floor(points.length / 2)
    const older = points.slice(0, h).reduce((s, p) => s + p.ef, 0) / h
    const recent = points.slice(h).reduce((s, p) => s + p.ef, 0) / (points.length - h)
    const deltaPct = older > 0 ? Math.round(((recent - older) / older) * 1000) / 10 : null
    const trend = recent > older * 1.02 ? 'up' : recent < older * 0.98 ? 'down' : 'flat'
    return { points, latest: points[points.length - 1].ef, trend, deltaPct }
  } catch { return null }
}

// #407 — SEASON COMPARISON. One power/pace-curve call carries MULTIPLE `curves=` specs → `data.list[i]` aligned to
// the specs order (verified). Each season = a trailing window (This=YTD · Last=365d · 2-ago=730d · All=10000d); the
// curve API can't do bounded years (that's the #415 server-computed follow-up). Read-only; null on no key/error.
export interface PowerSeason extends SeasonSpec { secs: number[]; watts: number[]; cp?: number; wPrime?: number; ftp?: number; best: (number | null)[] }
export async function fetchPowerSeasons(): Promise<PowerSeason[] | null> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return null
  const specs = seasonSpecs(daysSinceJan1(new Date()))
  try {
    const res = await fetch(`${ICU}/athlete/${athleteId}/power-curves?curves=${specs.map((s) => `${s.days}d`).join(',')}&type=Ride`, { headers: icuHeaders(apiKey) })
    if (!res.ok) return null
    const list = (await res.json())?.list || []
    return specs.map((s, i) => {
      const c = list[i] || {}
      const secs: number[] = c?.secs || [], watts: number[] = c?.values || []
      const pm = (c?.powerModels || []).find((m: { type?: string }) => m.type === 'FFT_CURVES') || (c?.powerModels || [])[0]
      return { ...s, secs, watts, cp: pm?.criticalPower, wPrime: pm?.wPrime, ftp: pm?.ftp, best: POWER_DURATIONS.map((d) => bestAt(secs, watts, d.secs)) }
    })
  } catch { return null }
}
export interface PaceSeason extends SeasonSpec { secs: number[]; pace: number[]; dist: number[]; cs?: number; dPrime?: number; best: (number | null)[] } // best = TIME (s) per PACE_DISTANCE
export async function fetchPaceSeasons(): Promise<PaceSeason[] | null> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return null
  const specs = seasonSpecs(daysSinceJan1(new Date()))
  try {
    const res = await fetch(`${ICU}/athlete/${athleteId}/pace-curves?curves=${specs.map((s) => `${s.days}d`).join(',')}&type=Run`, { headers: icuHeaders(apiKey) })
    if (!res.ok) return null
    const list = (await res.json())?.list || []
    return specs.map((s, i) => {
      const c = list[i] || {}
      const dist: number[] = c?.distance || [], val: number[] = c?.values || []
      const pts: { s: number; p: number; d: number }[] = []
      // #508 — only DISTANCES ≥ 400 m: a best TIME over 400 m+ can't be faked by one GPS spike, so it's glitch-free;
      // sub-400 m "pace" is GPS noise (JM had a raw 0:04/km) that wrecks the curve. (This is why intervals starts at 400 m.)
      for (let j = 0; j < dist.length; j++) if (dist[j] >= 400 && val[j] > 0) pts.push({ s: Math.round(val[j]), p: (val[j] / dist[j]) * 1000, d: dist[j] })
      pts.sort((a, b) => a.s - b.s)
      // #508 — MONOTONIC HULL: a mean-max curve must be non-decreasing in pace (a longer effort can NEVER be faster
      // than a shorter one). Any dip is a data glitch → clamp it up to the running max. (Researched: WKO5/TrainingPeaks
      // smooth the raw mean-max to this monotonic hull; removes the fake super-fast segments JM saw.)
      let mx = 0
      for (const pt of pts) { if (pt.p < mx) pt.p = mx; else mx = pt.p; pt.p = Math.round(pt.p) }
      const secs: number[] = [], pace: number[] = [], dm: number[] = []
      for (const pt of pts) {
        if (secs.length && pt.s === secs[secs.length - 1]) { if (pt.p < pace[pace.length - 1]) { pace[pace.length - 1] = pt.p; dm[dm.length - 1] = pt.d } }
        else { secs.push(pt.s); pace.push(pt.p); dm.push(pt.d) }
      }
      const pmodel = (c?.paceModels || [])[0]
      // best TIME to cover each target distance (nearest bucket within 15%), pace sanity-filtered (#400).
      const best = PACE_DISTANCES.map((pd) => {
        let bi = -1, bd = Infinity
        for (let j = 0; j < dm.length; j++) { const dd = Math.abs(dm[j] - pd.m); if (dd < bd) { bd = dd; bi = j } }
        if (bi < 0 || bd > pd.m * 0.15) return null
        return paceOkay(pace[bi]) ? secs[bi] : null
      })
      return { ...s, secs, pace, dist: dm, cs: pmodel?.criticalSpeed, dPrime: pmodel?.dPrime, best }
    })
  } catch { return null }
}

/** Best pace (sec/km) at the distance bucket nearest `meters` — for the pace-curve chips (1k/5k/10k). */
export function bestPaceAtDist(pc: PaceCurve, meters: number): number | null {
  let bi = -1, bd = Infinity
  for (let i = 0; i < pc.dist.length; i++) { const d = Math.abs(pc.dist[i] - meters); if (d < bd) { bd = d; bi = i } }
  return bi >= 0 && bd <= meters * 0.15 ? pc.pace[bi] : null // within 15% of the target distance
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
// #420 — intervals nests eFTP per-sport in `sportInfo` (e.g. [{type:'Ride', eftp:241, wPrime, pMax}]), NOT a
// top-level `eftp` field — so the eFTP trend was always empty ("No data yet"). Pull the Ride entry's eftp.
function rideEftp(d: unknown): number | null {
  const si = (d as { sportInfo?: { type?: string; eftp?: number }[] })?.sportInfo
  if (!Array.isArray(si)) return null
  const ride = si.find((x) => x?.type === 'Ride') || si[0]
  return typeof ride?.eftp === 'number' ? ride.eftp : null
}
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
      load: d.ctlLoad ?? d.atlLoad ?? null, eftp: rideEftp(d) ?? d.eftp ?? (d as Record<string, number>).icu_eftp ?? null,
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
  icu_weighted_avg_watts?: number // Normalized Power
  icu_variability_index?: number
  icu_efficiency_factor?: number
  icu_eftp?: number // estimated FTP from this activity
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  calories?: number
  icu_training_load?: number // TSS
  icu_intensity?: number // IF
  trimp?: number // HR-based load
  avg_lr_balance?: number // average left/right pedal balance (% on the right), when the meter records it
  trainer?: boolean
  icu_rpe?: number // 1-10
  feel?: number // 1-5 (intervals: 1=Strong … 5=Weak)
  strava_id?: number | string // set when the activity is linked to Strava
  device_name?: string // e.g. Garmin/Coros/Wahoo — the source that uploaded to intervals
  source?: string
  description?: string // the athlete's / coach's activity notes (public-ish text)
  // #273 — intervals custom ACTIVITY_FIELDs (private feedback), returned as top-level keys by code.
  LegsBefore?: string; LegsAfter?: string; FuelGI?: string; PainNiggles?: string; LifeConstraint?: string; MentalState?: string
}

/** Read feedback the athlete/coach ALREADY logged on an intervals activity (feel · RPE · custom
 *  fields), so Platyplus shows it instead of asking again. intervals stores these as 1-BASED number
 *  indices into the option lists (verified 2026-07-01). Returns null when nothing is present. */
export function readIcuFeedback(a?: IcuActivity | null): { feel?: string; rpe?: number; fields: Record<string, string> } | null {
  if (!a) return null
  const fields: Record<string, string> = {}
  const fieldSet = /run/i.test(a.type || '') ? RUN_FIELDS : ICU_FIELDS // #330 — read a run's fields with the RUN options
  for (const [label, opts] of fieldSet) {
    const code = ICU_FIELD_CODES[label]
    const raw = code ? (a as unknown as Record<string, unknown>)[code] : undefined
    const idx = typeof raw === 'number' ? raw : (typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN)
    if (idx >= 1 && idx <= opts.length) fields[label] = opts[idx - 1]      // 1-based index → label
    else if (typeof raw === 'string' && raw.trim() && opts.includes(raw)) fields[label] = raw // (defensive: label form)
  }
  const feel = a.feel && a.feel >= 1 && a.feel <= FEEL_LABELS.length ? FEEL_LABELS[a.feel - 1] : undefined
  const rpe = a.icu_rpe && a.icu_rpe >= 1 && a.icu_rpe <= 10 ? Math.round(a.icu_rpe) : undefined
  // #330 — Strava/device imports (and the coach's auto-review) can populate feel/icu_rpe WITHOUT the
  // athlete touching our form → the form then showed a phantom "POOR / RPE 10" as if entered. Our
  // CUSTOM fields (Legs/Fuel/Pain/…) only ever come from THIS app, so treat feedback as athlete-logged
  // ONLY when at least one custom field is present. Otherwise start the form blank.
  if (Object.keys(fields).length === 0) return null
  return { feel, rpe, fields }
}
/** Completed activities in a window (read-only). Empty on no key / error. */
export async function fetchActivities(oldest: string, newest: string): Promise<IcuActivity[]> {
  const { apiKey, athleteId, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return []
  try {
    // #267: no-store so a deleted-upstream activity can't be served from cache.
    const res = await fetch(`${ICU}/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`, { headers: icuHeaders(apiKey), cache: 'no-store' })
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
export interface ActivityStreams { time?: number[]; watts?: (number | null)[]; heartrate?: (number | null)[]; altitude?: (number | null)[]; cadence?: (number | null)[]; latlng?: [number, number][]; velocity_smooth?: (number | null)[]; distance?: (number | null)[] }
// #333 — runs also need velocity_smooth (m/s → pace) + distance so the completed-run view shows PACE, not watts.
export async function fetchActivityStreams(id: string | number, types: string[] = ['latlng', 'time', 'watts', 'heartrate', 'altitude', 'cadence', 'velocity_smooth', 'distance']): Promise<ActivityStreams> {
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
// #273 — the coach's post-workout review lives as intervals activity MESSAGES (a comment
// thread). The coach posts via the athlete's own key, so author name can't distinguish
// coach from athlete — we recognise coach messages by their template (a "Coach note …"
// header, a "Score: N/10", or the "Recovery / Supplements" companion). readIcuFeedback
// reads the athlete's fields; this reads the COACH's words so we can show them (#273 mock).
export interface CoachSection { title: string; lines: string[] }
export interface CoachNote { score?: number; title?: string; sections: CoachSection[] }
const COACH_HDR = /^(Coach note|Recovery\s*\/\s*Supplements)\b/i
const isCoachMsg = (content: string) => {
  const first = (content || '').trim().split('\n')[0] || ''
  return COACH_HDR.test(first) || /\bScore:\s*\d+\s*\/\s*10\b/i.test(content)
}
/** Parse the coach's message(s) into score + titled sections (pure — unit-tested). */
export function parseCoachNote(contents: string[]): CoachNote {
  const sections: CoachSection[] = []
  let title: string | undefined, score: number | undefined, cur: CoachSection | null = null
  for (const content of contents) for (const raw of (content || '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const sm = line.match(/Score:\s*(\d+)\s*\/\s*10/i); if (sm && score == null) score = Number(sm[1])
    const cn = line.match(/^Coach note\s*[-–—:]\s*(.+)$/i); if (cn) { title = cn[1].trim(); continue }
    if (/^[-•*]\s+/.test(line)) { if (!cur) { cur = { title: '', lines: [] }; sections.push(cur) } cur.lines.push(line.replace(/^[-•*]\s+/, '').trim()) }
    else { cur = { title: line, lines: [] }; sections.push(cur) }
  }
  return { score, title, sections: sections.filter((s) => s.lines.length) }
}
/** The intervals message thread for an activity, split into the coach's parsed review and the
 *  athlete's own free-text comment(s) (#273 — "my comments" must show, not just the coach's). */
export interface IcuThread { coach: CoachNote | null; comment?: string }
export async function fetchActivityThread(id: string | number): Promise<IcuThread> {
  const { apiKey, serverKey } = await getIcuConfig()
  if (!apiKey && !serverKey) return { coach: null }
  try {
    const res = await fetch(`${ICU}/activity/${id}/messages`, { headers: icuHeaders(apiKey), cache: 'no-store' })
    if (!res.ok) return { coach: null }
    const msgs = (await res.json()) as { content?: string }[]
    const list = Array.isArray(msgs) ? msgs.filter((m) => m && typeof m.content === 'string') : []
    const coachMsgs = list.filter((m) => isCoachMsg(m.content!))
    const mine = list.filter((m) => !isCoachMsg(m.content!)).map((m) => m.content!.trim()).filter(Boolean)
    const note = coachMsgs.length ? parseCoachNote(coachMsgs.map((m) => m.content!)) : null
    return { coach: note && note.sections.length ? note : null, comment: mine.join('\n\n') || undefined }
  } catch { return { coach: null } }
}
export const cleanLatLng = (t?: [number, number][]) => (t || []).filter((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
export const sportOfActivity = (a: IcuActivity) => (/swim/i.test(a.type) ? 'swim' : /run/i.test(a.type) ? 'run' : /ride|cycl/i.test(a.type) ? 'ride' : 'gym')
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

// Coggan power zones → representative %FTP. intervals expresses some steps as
// `{units:'power_zone', value:N}` ("ride in zone N") — without this map, value N (e.g. 2)
// was read as a raw % → a Zone-2 endurance block rendered as 2% FTP ≈ 5 W (the bug JM hit).
const ZONE_PCT: Record<number, number> = { 1: 50, 2: 65, 3: 83, 4: 98, 5: 113, 6: 135, 7: 160 }

/** Resolve a workout step's power to {start,end} as %FTP, handling ramps, steady %, and zones. */
export function stepPctFtp(p?: IcuStep['power']): { start: number; end: number; label?: string } {
  if (!p) return { start: 0, end: 0 }
  if (p.units === 'power_zone') {
    const z = Math.round(p.value ?? 0)
    // known zone → its midpoint %FTP (flat block); odd value that looks like a % → use it; else endurance
    const pct = ZONE_PCT[z] ?? (p.value && p.value >= 20 ? p.value : 65)
    return { start: pct, end: pct, label: z >= 1 && z <= 7 ? `Z${z}` : undefined }
  }
  // %ftp ramp {start,end} or steady {value}; fall back to value so steady efforts aren't 0 (#72/#107)
  return { start: p.start ?? p.value ?? 0, end: p.end ?? p.value ?? 0 }
}

/** Flatten workout_doc steps, expanding repeat blocks, into player segments. */
export function flattenIcuSteps(steps: IcuStep[] = []): Segment[] {
  const out: Segment[] = []
  const walk = (s: IcuStep) => {
    if (s.steps && s.reps) {
      for (let i = 0; i < s.reps; i++) s.steps!.forEach(walk)
    } else if (s.steps) {
      s.steps.forEach(walk)
    } else if (s.duration) {
      // #312: a run step carries `pace` (% of threshold pace) instead of `power` — read whichever
      // intervals sent so an imported run isn't flattened to 0.
      const { start, end, label } = stepPctFtp(s.pace ?? s.power)
      out.push({ duration: s.duration, powerStart: start, powerEnd: end, label })
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
