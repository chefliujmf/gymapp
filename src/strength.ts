// Strength engine: estimated 1-rep max + the inverse (suggest a weight for a target
// rep count) + history helpers. This is the loop that lets the coach prescribe reps
// and the app fill the weight.
import type { WorkoutLog } from './db'

/** Estimated 1-rep max — average of Epley & Brzycki (most accurate at 2–10 reps). */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps) return 0
  if (reps <= 1) return weight
  const epley = weight * (1 + reps / 30)
  const brzycki = reps < 37 ? (weight * 36) / (37 - reps) : epley
  return (epley + brzycki) / 2
}

/** RPE-adjusted e1RM (#497 — the gym analog of "estimate from the effort you actually gave"). A set stopped at
 * `rpe` left (10 − rpe) reps in reserve, so it equals a set of reps+(10−rpe) taken to failure (RTS / Tuchscherer).
 * This is more honest than assuming every logged set was maximal — 5 @ RPE 8 implies a higher 1RM than 5 to failure.
 * No RPE → falls back to plain e1rm (treats the set as near-failure, the existing behaviour). See docs/e1rm.md. */
export function e1rmRpe(weight: number, reps: number, rpe?: number | null): number {
  if (!weight || !reps) return 0
  const rir = rpe != null && rpe > 0 && rpe <= 10 ? Math.max(0, 10 - rpe) : 0
  return e1rm(weight, reps + rir)
}

/** Honest confidence in an e1RM read (#497 — the gym "same concept" as the FTP/pace estimates). Tightest from a
 * heavy low-rep set; loosest when extrapolating from a high-rep set or stale data. `reps`/`rpe` describe the SET the
 * estimate came from; effective reps = reps + reps-in-reserve. Pure so it's unit-tested alongside the formulas. */
export function e1rmConfidence(inp: { reps: number; rpe?: number | null; ageDays?: number | null }): { pct: number; cls: 'strong' | 'good' | 'need' | 'learn'; label: string } {
  const reps = inp.reps || 0
  const hasRpe = inp.rpe != null && inp.rpe > 0 && inp.rpe <= 10
  const rir = hasRpe ? Math.max(0, 10 - (inp.rpe as number)) : 0
  let pct = reps <= 5 ? 90 : reps <= 8 ? 80 : reps <= 12 ? 65 : 45 // Epley/Brzycki extrapolate least from a low-rep set
  if (!hasRpe) pct -= 8 // no RPE → we had to assume the set was near failure; it might not have been
  else pct -= rir * 3 // we knew the effort, but a big reserve means a longer extrapolation to a true 1RM
  if (inp.ageDays != null && inp.ageDays > 42) pct -= 15 // a stale max is a weaker claim on today's strength
  pct = Math.max(30, Math.min(95, pct))
  const cls = pct >= 85 ? 'strong' : pct >= 68 ? 'good' : pct >= 50 ? 'need' : 'learn'
  const label = reps <= 5 ? 'Heavy set — dependable' : reps <= 12 ? 'Moderate reps — solid' : 'High-rep set — rough guide'
  return { pct, cls, label }
}

/** Inverse: the weight that should let you hit `reps` given an estimated 1RM. */
export function weightForReps(oneRM: number, reps: number): number {
  if (!oneRM) return 0
  if (reps <= 1) return oneRM
  const wEpley = oneRM / (1 + reps / 30)
  const wBrzycki = reps < 37 ? (oneRM * (37 - reps)) / 36 : wEpley
  return (wEpley + wBrzycki) / 2
}

/** Round a load to a usable increment (2.5 kg default). */
export const roundLoad = (w: number, step = 2.5) => (w > 0 ? Math.round(w / step) * step : 0)

// #527/#251 — the honest gym-session DURATION. GymPlayer's wall-clock (`Date.now()−startedAt`) is fragile: a
// tab close / PWA reload / remount can reset the start, so a full session logs an impossibly-short time (JM:
// 20 sets in "11 min"). When the wall-clock is implausible for the work actually done, fall back to the PLANNED
// estimate — which is exactly what intervals.icu shows for the session (JM: "stay consistent with intervals").
// A completed working set + its rest is ~≥0.75 min, so a session can't be shorter than sets×0.75. Pure + tested.
export function reliableSessionMinutes(inp: { wallMin: number; setsCompleted?: number; plannedMin?: number }): number {
  const wall = Math.max(0, Math.round(inp.wallMin || 0))
  const sets = Math.max(0, inp.setsCompleted || 0)
  const floor = Math.round(sets * 0.75)               // conservative minimum plausible time for the sets logged
  if (wall >= floor) return Math.max(1, wall)          // wall-clock is believable → trust it
  return Math.max(1, floor, Math.round(inp.plannedMin || 0)) // broken timer → planned estimate (= intervals) / floor
}

// #255 — per-lift coach insight from the dated e1RM history: are you progressing, at a PR, or stalled,
// + a concrete next step. Pure + unit-tested. `fmt` renders a kg value in the user's display unit.
export type LiftTone = 'pr' | 'up' | 'stall' | 'flat' | 'new'
export function exerciseInsight(pts: { date: number; e1rm: number }[], fmt: (kg: number) => string = (v) => `${Math.round(v)} kg`): { tone: LiftTone; text: string } | null {
  const p = pts.filter((x) => x.e1rm > 0).sort((a, b) => a.date - b.date)
  if (!p.length) return null
  const vals = p.map((x) => x.e1rm)
  const last = vals[vals.length - 1]
  if (p.length === 1) return { tone: 'new', text: `First logged session at ${fmt(last)} est 1RM — log a few more and I'll track your progression and suggest jumps.` }
  const peak = Math.max(...vals)
  const peakIdx = vals.lastIndexOf(peak)
  const first = vals[0]
  const deltaAll = last - first
  const prev = vals[vals.length - 2] // immediately-previous session
  const sessionsSincePeak = vals.length - 1 - peakIdx
  const weeksSincePeak = Math.round((p[p.length - 1].date - p[peakIdx].date) / (7 * 864e5))
  if (last >= peak - 0.01) return { tone: 'pr', text: `📈 On form — est 1RM ${fmt(last)}${deltaAll > 0.5 ? `, +${fmt(deltaAll)} since you started` : ''}. Nudge the top set up while it moves clean.` }
  if (sessionsSincePeak >= 3) return { tone: 'stall', text: `⚠️ Stalled — ${weeksSincePeak >= 1 ? `~${weeksSincePeak} wk` : `${sessionsSincePeak} sessions`} off your ${fmt(peak)} peak. Change the stimulus: vary the rep range, or take a lighter deload week then rebuild.` }
  if (last > prev + 0.01) return { tone: 'up', text: `Trending up — ${fmt(last)}, back toward your ${fmt(peak)} peak. Keep the progression going.` }
  return { tone: 'flat', text: `Holding ~${fmt(last)} (peak ${fmt(peak)}). Push the top set for a rep more, or add a set, to break through.` }
}

/** Best e1RM per exercise name from recent logs (the working number to prescribe against). */
export function bestE1rmByExercise(logs: WorkoutLog[], sinceDays = 120): Map<string, { e1rm: number; date: string }> {
  const cut = new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10)
  const m = new Map<string, { e1rm: number; date: string }>()
  for (const log of logs) {
    if (!log.sets || !log.exNames || log.date < cut) continue
    for (const [idx, setArr] of Object.entries(log.sets)) {
      const name = log.exNames[Number(idx)]
      if (!name || !Array.isArray(setArr)) continue
      let best = 0
      for (const s of setArr) if (s.weight && s.reps) best = Math.max(best, e1rm(s.weight, s.reps))
      if (best > 0) { const cur = m.get(name); if (!cur || best > cur.e1rm) m.set(name, { e1rm: best, date: log.date }) }
    }
  }
  return m
}

/** The most recent logged sets for an exercise — the grey "last time" reference. */
export function lastSessionSets(logs: WorkoutLog[], name: string): { weight?: number; reps?: number }[] | null {
  for (const log of [...logs].sort((a, b) => b.date.localeCompare(a.date))) {
    if (!log.sets || !log.exNames) continue
    const idx = log.exNames.indexOf(name)
    if (idx >= 0 && log.sets[idx]?.length) return log.sets[idx]
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// #448 — strength Stats/Progress analytics. All pure + unit-tested; the science
// (Epley/Brzycki, RIR, Schoenfeld volume landmarks, progressive overload) is in
// docs/strength-analytics.md. `muscleOf` resolves an exercise → its primary muscle
// group; the client passes a catalog-backed resolver so these stay pure/testable.
// ─────────────────────────────────────────────────────────────────────────────

export type MuscleOf = (name: string, exId?: string) => string | undefined
type DoneSet = { name: string; exId?: string; weight: number; reps: number; date: string; at: number }

/** Every COMPLETED working set across the logs, flattened with its exercise + date. Warm-ups aren't marked in
 *  the data, so `done` is our best "working set" signal (a limitation noted in the KB). */
function* eachDoneSet(logs: WorkoutLog[]): Generator<DoneSet> {
  for (const log of logs) {
    if (!log.sets || !log.exNames) continue
    const at = log.completedAt || Date.parse(log.date) || 0
    for (const [idx, arr] of Object.entries(log.sets)) {
      const name = log.exNames[Number(idx)]
      const exId = log.exIds?.[Number(idx)]
      if (!name || !Array.isArray(arr)) continue
      // #591 — a done set counts even with NO weight (bodyweight: push-ups, pull-ups, glute bridge). Weight is
      // optional (→ 0); e1RM consumers guard weight>0 so bodyweight never shows a bogus "0 kg 1RM", but set-COUNTING
      // (sets-per-muscle) includes it — a bodyweight set is still a working set for that muscle.
      for (const s of arr) if (s.done && !s.warmup && s.reps) yield { name, exId, weight: s.weight || 0, reps: s.reps, date: log.date, at }
    }
  }
}

/** Whole (Mon-based) weeks spanned by a range in days — the denominator for "per week" rates. Floored to 1. */
export const rangeWeeks = (days: number): number => Math.max(1, Math.round(days / 7))

/** #251 fix — the top summary reflects the SELECTED range: sessions, total minutes on the bar, and consistency
 *  (sessions/week) — honest effort, NOT vanity total-kg. `days` = the filter span so consistency is real. */
export function rangeSummary(logs: WorkoutLog[], days: number): { sessions: number; totalMin: number; perWeek: number } {
  const sessions = logs.length
  // Guard legacy logs with a broken wall-clock (#527): floor each session vs the sets it recorded.
  const totalMin = logs.reduce((s, l) => s + reliableSessionMinutes({ wallMin: l.duration || 0, setsCompleted: (l as { setsCompleted?: number }).setsCompleted }), 0)
  const perWeek = Math.round((sessions / rangeWeeks(days)) * 10) / 10
  return { sessions, totalMin, perWeek }
}

// Evidence-based weekly-set landmarks per muscle (Schoenfeld/Krieger dose-response; MEV/MAV/MRV). See KB.
export const SETS_LOW = 10
export const SETS_HIGH = 20
export type VolStatus = 'low' | 'ok' | 'high'
export interface MuscleVolume { muscle: string; total: number; perWeek: number; status: VolStatus }

// #534 — the GYM ENGINE is sport+goal-adaptive. Volume targets are GOAL-DEPENDENT (docs/strength-coaching.md §2):
// a flat 10–20 band is a hypertrophy prescription and wrongly flags an endurance athlete as "low" forever.
export type GymFocus = 'muscle' | 'strength' | 'support_build' | 'support' | 'health'
// #648 — reps/%1RM/intent are the PRIMARY-lift REP SCHEME per focus (mirror of server/gym-split.js REP_SCHEME — keep
// in sync). low/high = weekly SETS/muscle. So each focus carries BOTH its volume dose AND its rep/load prescription.
export interface FocusSpec { low: number; high: number; label: string; note: string; reps: string; pctLow: number; pctHigh: number; intent: string }
export const GYM_FOCUS: Record<GymFocus, FocusSpec> = {
  muscle: { low: 10, high: 20, label: 'Build muscle', note: '10–20 hard sets/muscle a week drives growth (Schoenfeld).', reps: '6–12', pctLow: 67, pctHigh: 85, intent: 'Close to failure (1–3 in reserve), controlled eccentric, progressive overload.' },
  strength: { low: 6, high: 12, label: 'Get stronger', note: 'Heavier (>85% 1-RM), fewer reps — intensity over volume (NSCA).', reps: '3–5', pctLow: 85, pctHigh: 95, intent: 'Heavy, crisp technique, long rests — intensity over volume.' },
  // #534 — endurance-first athlete who ALSO wants muscle (JM: "you can build lean muscle in cycling"). A real
  // hypertrophy dose, but lower/dosed so it doesn't wreck the sport — concurrent hypertrophy.
  support_build: { low: 6, high: 12, label: 'Lean muscle + sport', note: 'Build lean muscle while your sport stays #1 — a real hypertrophy dose, dosed and scheduled around key sessions (concurrent training).', reps: '4–6 mains / 6–12 accessories', pctLow: 75, pctHigh: 87, intent: 'Heavy mains for carry-over + dosed hypertrophy on accessories.' },
  // #648 — endurance main sport, no muscle intent: HEAVY, LOW-rep, fast concentric — force + economy, minimal mass
  // (Rønnestad & Mujika 2014, Beattie 2014, Vikmoen 2016). NOT 3×10 hypertrophy.
  support: { low: 2, high: 8, label: 'Support my sport', note: 'Maintenance dose — a little holds strength; keep it clear of key sessions (concurrent training).', reps: '3–6', pctLow: 80, pctHigh: 90, intent: 'Heavy, drive up fast, not to failure — force + economy, minimal mass.' },
  health: { low: 2, high: 12, label: 'Health', note: 'Hit all major muscles ~2×/week (ACSM).', reps: '8–15', pctLow: 50, pctHigh: 75, intent: 'Comfortable, full range, all major groups ~2×/week.' },
}

/** Infer the athlete's GYM focus from their MAIN sport + objective (JM 2026-07-16). The explicit MAIN sport is the
 *  STRONGEST signal (an endurance main sport → gym is support, even if they'd also like some muscle — that nuance is
 *  the coach's job). With no main sport set, the objective decides, then the first sport; default health. */
export function inferGymFocus(input: { mainSport?: string; sports?: string[]; goal?: string }): GymFocus {
  const goal = String(input.goal || '').toLowerCase()
  const isEndurance = (s: string) => /cycl|ride|bike|\brun|jog|swim|tri|endurance|row/.test(s)
  const goalMuscle = /muscle|hypertroph|bigger|\bmass\b|tone up|\bbulk\b|physique|\blean\b/.test(goal)
  const goalStrength = /\bstrong|1\s?-?rm|one[- ]rep|deadlift|squat|bench|powerlift/.test(goal)
  const goalEndurance = /\bftp\b|watt|\bpace\b|marathon|\brace\b|\bride\b|\brun\b|\bbike\b|cycl|endurance|triathlon|\bvo2\b/.test(goal)
  const main = String(input.mainSport || '').toLowerCase()
  if (main) { // an explicit main sport wins — but an endurance athlete who WANTS muscle gets the hybrid
    if (isEndurance(main)) return goalMuscle ? 'support_build' : 'support'
    if (/strength|gym|lift|weight|bodybuild|power/.test(main)) return goalStrength && !goalMuscle ? 'strength' : 'muscle'
  }
  if (goalMuscle) return 'muscle'
  if (goalStrength && !goalEndurance) return 'strength'
  const first = String((input.sports && input.sports[0]) || '').toLowerCase()
  if (goalEndurance || isEndurance(first)) return 'support'
  if (/strength|gym|lift|weight|bodybuild|power/.test(first)) return 'muscle'
  return 'health'
}

// %1-RM intensity zones — the strength analog of power/pace zones (NSCA rep-max continuum, docs/strength-coaching.md §1).
export const INTENSITY_ZONES = [
  { key: 'strength', label: 'Strength', min: 85, max: 200, reps: '1–5', color: '#ff6b6b' },
  { key: 'hypertrophy', label: 'Hypertrophy', min: 67, max: 85, reps: '6–12', color: '#34e07d' },
  { key: 'endurance', label: 'Endurance', min: 0, max: 67, reps: '12+', color: '#7fd1ff' },
] as const
/** Which intensity zone a working set falls in, from its load vs the lift's 1-RM. */
export function intensityZone(weight: number, e1rmVal: number): (typeof INTENSITY_ZONES)[number] | null {
  if (!weight || !e1rmVal) return null
  const pct = (weight / e1rmVal) * 100
  return INTENSITY_ZONES.find((z) => pct >= z.min && pct < z.max) || INTENSITY_ZONES[0]
}

/** Distinct 7-day weeks in which the athlete actually TRAINED (≥1 logged session). The denominator for the
 *  per-week metrics — averaging over empty calendar weeks in a wide filter would dilute the number into nonsense
 *  (JM: "0.8 low" over an 8-week filter with 3 days of data). We report "per TRAINING week" instead. */
export function activeWeeks(logs: WorkoutLog[]): number {
  const wk = new Set<number>()
  for (const l of logs) { const at = l.completedAt || Date.parse(l.date) || 0; if (at) wk.add(Math.floor(at / (7 * 864e5))) }
  return Math.max(1, wk.size)
}

export interface SetBand { low: number; high: number }
/** Resolve the weekly-sets target: a COACH-set band wins (JM: "why don't the coach define the target and we use
 *  that?"); else the default band for the athlete's focus. */
export const bandFor = (target: GymFocus | SetBand): SetBand => (typeof target === 'string' ? GYM_FOCUS[target] : target)

/** A REALISTIC weekly-sets target: the goal's ideal band CAPPED by what the athlete's gym FREQUENCY can deliver
 *  (~2–4 hard sets/muscle per weekly gym session). So someone who lifts 1×/week isn't measured against a 3–4×/week
 *  volume and told they're "always low" (JM: "if I have 1 gym per week it will always be low... it's stupid"). The
 *  coach can still override this with a specific band. Pure + tested. #534. */
export function weeklySetTargetFor(focus: GymFocus, sessionsPerWeek: number): SetBand {
  const ideal = GYM_FOCUS[focus]
  const spw = Math.max(0.5, sessionsPerWeek || 0)
  const high = Math.max(2, Math.min(ideal.high, Math.round(spw * 4)))
  const low = Math.max(1, Math.min(ideal.low, Math.round(spw * 2)))
  return { low: Math.min(low, high), high }
}

/** Completed working sets per PRIMARY muscle group, averaged over the weeks you TRAINED, with status vs the target
 *  band — the COACH's band when set, else the default for the athlete's GYM FOCUS. #534. */
export function weeklySetsPerMuscle(logs: WorkoutLog[], muscleOf: MuscleOf, target: GymFocus | SetBand = 'muscle'): MuscleVolume[] {
  const wk = activeWeeks(logs)
  const { low, high } = bandFor(target)
  const tot = new Map<string, number>()
  for (const s of eachDoneSet(logs)) {
    const m = muscleOf(s.name, s.exId)
    if (!m) continue
    tot.set(m, (tot.get(m) || 0) + 1)
  }
  return [...tot.entries()]
    .map(([muscle, total]) => {
      const perWeek = Math.round((total / wk) * 10) / 10
      const status: VolStatus = perWeek < low ? 'low' : perWeek > high ? 'high' : 'ok'
      return { muscle, total, perWeek, status }
    })
    .sort((a, b) => b.perWeek - a.perWeek)
}

export interface MainLift { name: string; exId?: string; muscle?: string; e1rm: number; confidencePct: number; tone: LiftTone; deltaPct: number; sessions: number }

/** Dated best-e1RM series per exercise (one point per session), plus session count — the base for trends. */
function seriesByExercise(logs: WorkoutLog[]): Map<string, { exId?: string; pts: { date: number; e1rm: number }[]; lastReps: number }> {
  const m = new Map<string, { exId?: string; byDay: Map<string, { e1rm: number; reps: number }>; }>()
  for (const s of eachDoneSet(logs)) {
    let e = m.get(s.name)
    if (!e) { e = { exId: s.exId, byDay: new Map() }; m.set(s.name, e) }
    const est = e1rm(s.weight, s.reps)
    if (!est) continue // bodyweight (no weight) → no 1RM point; it still counted for sets-per-muscle upstream
    const cur = e.byDay.get(s.date)
    if (!cur || est > cur.e1rm) e.byDay.set(s.date, { e1rm: est, reps: s.reps })
  }
  const out = new Map<string, { exId?: string; pts: { date: number; e1rm: number }[]; lastReps: number }>()
  for (const [name, e] of m) {
    const pts = [...e.byDay.entries()].map(([d, v]) => ({ date: Date.parse(d), e1rm: v.e1rm, reps: v.reps })).sort((a, b) => a.date - b.date)
    out.set(name, { exId: e.exId, pts: pts.map(({ date, e1rm }) => ({ date, e1rm })), lastReps: pts.length ? pts[pts.length - 1].reps : 8 })
  }
  return out
}

/** The user's most-trained lifts (by number of sessions) — bounded so the card grid stays 4–6 no matter how
 *  many exercises are in the library. Each carries its working e1RM, honest confidence, tone and total drift. */
export function mainLifts(logs: WorkoutLog[], muscleOf: MuscleOf | undefined, n = 4): MainLift[] {
  const series = seriesByExercise(logs)
  const ranked = [...series.entries()].sort((a, b) => b[1].pts.length - a[1].pts.length)
  const out: MainLift[] = []
  for (const [name, s] of ranked) {
    if (out.length >= n || !s.pts.length) break
    const last = s.pts[s.pts.length - 1].e1rm
    const first = s.pts[0].e1rm
    const ins = exerciseInsight(s.pts)
    const ageDays = Math.round((Date.now() - s.pts[s.pts.length - 1].date) / 864e5)
    out.push({
      name, exId: s.exId, muscle: muscleOf?.(name, s.exId),
      e1rm: last, deltaPct: first > 0 ? Math.round(((last - first) / first) * 100) : 0,
      confidencePct: e1rmConfidence({ reps: s.lastReps, ageDays }).pct,
      tone: ins ? ins.tone : 'new', sessions: s.pts.length,
    })
  }
  return out
}

export interface ExerciseHistory {
  name: string; sessions: number; e1rm: number; deltaPct: number; tone: LiftTone; insight: string; confidencePct: number
  pts: { date: number; e1rm: number }[]
  repBests: { reps: number; weight: number; e1rm: number; date: number }[]
  weeklyVolume: { week: number; volume: number }[]
  next: { weightKg: number; reps: number; note: string } | null
}

/** Everything the per-exercise page needs (#227): dated e1RM trend, best set per rep bucket, weekly volume,
 *  the coach insight, and the next progressive-overload target. */
export function exerciseHistory(logs: WorkoutLog[], name: string, fmt: (kg: number) => string = (v) => `${Math.round(v)} kg`): ExerciseHistory | null {
  const sets = [...eachDoneSet(logs)].filter((s) => s.name === name)
  if (!sets.length) return null
  const byDay = new Map<string, number>()
  const volByWeek = new Map<number, number>()
  const repBucket = new Map<number, { reps: number; weight: number; e1rm: number; date: number }>()
  for (const s of sets) {
    const est = e1rm(s.weight, s.reps)
    if (est) byDay.set(s.date, Math.max(byDay.get(s.date) || 0, est)) // bodyweight sets add no 1RM point (guard 0 kg)
    const wk = Math.floor(s.at / (7 * 864e5))
    volByWeek.set(wk, (volByWeek.get(wk) || 0) + s.weight * s.reps)
    const bucket = s.reps <= 1 ? 1 : s.reps <= 3 ? 3 : s.reps <= 5 ? 5 : s.reps <= 8 ? 8 : s.reps <= 12 ? 12 : 15
    const cur = repBucket.get(bucket)
    if (!cur || est > cur.e1rm) repBucket.set(bucket, { reps: bucket, weight: s.weight, e1rm: est, date: s.at })
  }
  const pts = [...byDay.entries()].map(([d, e]) => ({ date: Date.parse(d), e1rm: e })).sort((a, b) => a.date - b.date)
  const ins = exerciseInsight(pts, fmt)
  const last = pts[pts.length - 1].e1rm
  const first = pts[0].e1rm
  const recent = sets.reduce((m, s) => (s.at > m.at ? s : m), sets[0]) // confidence from the freshest set (reps + age)
  return {
    name, sessions: pts.length, e1rm: last,
    deltaPct: first > 0 ? Math.round(((last - first) / first) * 100) : 0,
    tone: ins ? ins.tone : 'new', insight: ins ? ins.text : '',
    confidencePct: e1rmConfidence({ reps: recent.reps, ageDays: Math.round((Date.now() - recent.at) / 864e5) }).pct,
    pts,
    repBests: [...repBucket.values()].sort((a, b) => a.reps - b.reps),
    weeklyVolume: [...volByWeek.entries()].map(([week, volume]) => ({ week, volume })).sort((a, b) => a.week - b.week),
    next: nextTarget(sets),
  }
}

/** Next progressive-overload target (double progression): once you own the top of a rep range, add the smallest
 *  load increment; otherwise chase a rep. Conservative + repeatable. From the heaviest recent working set. */
export function nextTarget(sets: { weight: number; reps: number; at: number }[], topReps = 8, step = 2.5): { weightKg: number; reps: number; note: string } | null {
  if (!sets.length) return null
  const recent = [...sets].sort((a, b) => b.at - a.at)
  const heaviest = recent.reduce((m, s) => (s.weight > m.weight ? s : m), recent[0])
  if (heaviest.reps >= topReps) {
    const w = roundLoad(heaviest.weight + step, step)
    return { weightKg: w, reps: Math.max(3, topReps - 3), note: `You own ${heaviest.weight}×${heaviest.reps} — add load: ${w} kg for ${Math.max(3, topReps - 3)}–${topReps}.` }
  }
  return { weightKg: heaviest.weight, reps: heaviest.reps + 1, note: `Chase a rep: ${heaviest.weight} kg for ${heaviest.reps + 1} (then keep adding reps to ${topReps} before you add weight).` }
}

export interface DigestItem { kind: 'stall' | 'low-volume' | 'missing' | 'pr' | 'mover'; title: string; detail: string; name?: string; muscle?: string }
export interface StrengthDigest { needsAttention: DigestItem[]; wins: DigestItem[] }

// Canonical major groups, for the "you've trained everything else but not X" imbalance flag. The client can
// override with the real catalog facet vocabulary.
export const MAJOR_MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core']

/** The actionable feed of OBJECTIVE facts: what stalled (needsAttention) and the WINS (PRs, biggest movers).
 *  #534 — volume adequacy ("is this enough?") is NOT judged here: that's the COACH's job (goal + sport + season),
 *  surfaced in its insight, not a blind app low/ok/high (JM: "we'll do it differently, shown by the coach"). */
export function strengthDigest(logs: WorkoutLog[], fmt: (kg: number) => string = (v) => `${Math.round(v)} kg`): StrengthDigest {
  const needsAttention: DigestItem[] = []
  const wins: DigestItem[] = []
  const series = seriesByExercise(logs)

  // Per-lift stalls + movers (only lifts with enough history to judge) — these are measured facts, not opinions.
  const movers: { name: string; deltaPct: number }[] = []
  for (const [name, s] of series) {
    if (s.pts.length < 2) continue
    const ins = exerciseInsight(s.pts, fmt)
    if (!ins) continue
    const last = s.pts[s.pts.length - 1].e1rm
    const first = s.pts[0].e1rm
    const deltaPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0
    if (ins.tone === 'stall') needsAttention.push({ kind: 'stall', name, title: `${name} stalled`, detail: ins.text })
    if (ins.tone === 'pr' && deltaPct >= 2) wins.push({ kind: 'pr', name, title: `${name} ${deltaPct > 0 ? '+' + deltaPct + '%' : 'at your peak'}`, detail: `Working max ${fmt(last)}. ${ins.text.replace(/^📈\s*/, '')}` })
    if (deltaPct >= 3) movers.push({ name, deltaPct })
  }

  // Best movers as wins (dedup vs PRs already listed)
  const named = new Set(wins.map((w) => w.name))
  for (const mv of movers.sort((a, b) => b.deltaPct - a.deltaPct).slice(0, 3)) if (!named.has(mv.name)) wins.push({ kind: 'mover', name: mv.name, title: `${mv.name} +${mv.deltaPct}%`, detail: 'Steady progress this block.' })

  return { needsAttention, wins }
}
