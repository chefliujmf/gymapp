// #516b — DETERMINISTIC 14-day plan SKELETON. The periodization MATH (weekly load band, day-by-day TSS,
// rest/long/hard distribution, Form projection) already lives in readiness.js as pure functions — the coach
// LLM was burning round-trips orchestrating it. This module chains those functions and fills the 4 gaps
// (sport assignment · intensity zone · session duration · workout segments) so a full 14-day plan skeleton
// is produced in CODE with ZERO model calls. The LLM is then a REVIEWER: it sees the skeleton + readiness +
// check-in and OVERRIDES/refines any day and writes the human text. Quality is not capped by code — the model
// always has the final say. Pure (no I/O) → unit-tested in src/plan-skeleton.test.ts.
//
// Segment format is the SAME neutral shape the rest of the app uses: {duration(sec), powerStart, powerEnd,
// label} where the number is "% of threshold" (ride → %FTP, run → %threshold-pace; encodeStep/nativeWorkoutText
// render the sport-specific target). Load is verified with the real plannedTss (Coggan TSS), so a built
// workout carries the SAME training stress the periodization assigned.

import { weeklyLoadBudget, defaultLoadPlan, recentRestDows, periodizedLoads, projectFormSeries, isoMonday } from './readiness.js'
import { plannedTss, clampEasyEfforts, normalizeRamps } from './icu-steps.js'

// --- date helpers (match readiness.js: UTC noon-anchored 'YYYY-MM-DD') --------------------------------
const dow = (d) => new Date(d + 'T12:00:00Z').getUTCDay()            // 0=Sun..6=Sat
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const round5 = (n) => Math.round(n / 5) * 5

// --- intensity zones (% of threshold) --------------------------------------------------------------
// Anchored to the app's zone model (icu-steps ZONE_PCT / coach-engine method): easy is genuinely easy,
// quality is spaced. Sweet-spot/threshold/VO2 are authored as INTERVALS; endurance/recovery are steady.
export const ZONES = {
  recovery:  { name: 'Recovery',   pct: 50, kind: 'steady' },
  endurance: { name: 'Endurance',  pct: 65, kind: 'steady' },
  tempo:     { name: 'Tempo',      pct: 80, kind: 'steady' },
  sweetspot: { name: 'Sweet spot', pct: 88, kind: 'intervals', reps: 3, workSec: 720, recSec: 180, recPct: 60 },
  threshold: { name: 'Threshold',  pct: 99, kind: 'intervals', reps: 3, workSec: 600, recSec: 180, recPct: 55 },
  vo2:       { name: 'VO2max',     pct: 112, kind: 'intervals', reps: 5, workSec: 180, recSec: 150, recPct: 50 },
}

// Quality-zone rotation per periodization phase (2 quality days/week → [dayA, dayB], rotated weekly for variety).
const QUALITY_BY_PHASE = {
  build:    ['threshold', 'sweetspot'],
  peak:     ['vo2', 'threshold'],
  recovery: ['tempo', 'endurance'],
  base:     ['sweetspot', 'endurance'],
}

// --- gap 3: session duration (minutes) from a target TSS + zone -------------------------------------
// From the Coggan identity TSS = hours × IF² × 100 ⇒ hours = TSS / (IF² × 100). IF = zone% / 100. This is
// a quick ESTIMATE for the skeleton; buildWorkoutSegments does the precise sizing against real plannedTss.
export function sessionDuration(targetTss, zonePct) {
  const IF = (Number(zonePct) || 65) / 100
  if (!(targetTss > 0) || !(IF > 0)) return 0
  const min = (targetTss / (IF * IF * 100)) * 60
  return clamp(round5(min), 20, 210)
}

// --- gap 4: build warmup/work/cooldown segments that HIT the target TSS -----------------------------
// Template per zone, then scale the WORK portion so plannedTss lands on target (TSS ~linear in work
// duration at fixed intensity → one proportional pass is within a few %). Warmup/cooldown are fixed and
// easy-labelled, so clampEasyEfforts leaves them alone; it's a safety pass for any over-hot easy segment.
export function buildWorkoutSegments(zoneKey, targetTss) {
  const z = ZONES[zoneKey] || ZONES.endurance
  const warm = { duration: 600, powerStart: 50, powerEnd: 70, label: 'Warm-up' }
  const cool = { duration: 300, powerStart: 50, powerEnd: 50, label: 'Cool-down' }
  // build(f): the WORK block(s) scaled by factor f (warmup/cooldown fixed).
  const build = (f) => {
    const work = []
    const r30 = (s) => Math.round(s / 30) * 30 // clean 30-second multiples (720s = 12m, not 736s)
    if (z.kind === 'steady') {
      work.push({ duration: Math.max(300, r30(1800 * f)), powerStart: z.pct, powerEnd: z.pct, label: z.name })
    } else {
      const reps = z.reps
      for (let i = 0; i < reps; i++) {
        work.push({ duration: Math.max(60, r30(z.workSec * f)), powerStart: z.pct, powerEnd: z.pct, label: z.name })
        if (i < reps - 1) work.push({ duration: z.recSec, powerStart: z.recPct, powerEnd: z.recPct, label: 'recovery' })
      }
    }
    return [warm, ...work, cool]
  }
  let segs = build(1)
  const m = plannedTss(segs)
  if (m && m.tss > 0 && targetTss > 0) {
    const f = clamp(targetTss / m.tss, 0.3, 3.5)
    segs = build(f)
  }
  segs = normalizeRamps(segs)
  segs = clampEasyEfforts(z.name, segs).segments // safety: never let an easy-labelled segment sit hot
  const tot = segs.reduce((a, s) => a + (Number(s.duration) || 0), 0)
  const tss = plannedTss(segs)
  return { segments: segs, durationMin: Math.round(tot / 60), tss: tss ? tss.tss : null }
}

// --- gap 2: intensity zone for a day's classification + phase ---------------------------------------
export function suggestIntensityZone(cls, phase = 'base', qualityIndex = 0, weekIndex = 0) {
  if (cls === 'rest') return null
  if (cls === 'long') return 'endurance'
  if (cls === 'easy') return 'endurance'
  // quality: rotate the phase's two quality zones by which quality day it is + the week (variety, no monotony).
  const pair = QUALITY_BY_PHASE[phase] || QUALITY_BY_PHASE.base
  return pair[(qualityIndex + weekIndex) % pair.length]
}

// --- gap 1: classify each day of a Mon–Sun week from its TSS, then enforce the HARD training-day cap -----
// Leans on periodizedLoads (rest = 0 TSS, weekend-boosted long day). Highest-TSS day = 'long'; up to 2 next
// spaced days = 'quality'; the rest = 'easy'. Then trims to `trainingDays` by resting the lowest-load days.
function classifyWeek(weekDates, dailyTss, trainingDays) {
  const days = weekDates.map((date) => ({ date, tss: Number(dailyTss[date]) || 0, cls: 'rest' }))
  const active = days.filter((d) => d.tss > 5).sort((a, b) => b.tss - a.tss)
  if (!active.length) return days
  active[0].cls = 'long'
  // pick up to 2 quality days, each ≥2 days apart from 'long' and each other (never back-to-back hard).
  const chosen = [active[0].date]
  const spaced = (date) => chosen.every((c) => Math.abs(idx(date) - idx(c)) >= 2)
  const idx = (date) => weekDates.indexOf(date)
  let want = active.length >= 3 ? 2 : 0
  for (let i = 1; i < active.length && want > 0; i++) {
    if (spaced(active[i].date)) { active[i].cls = 'quality'; chosen.push(active[i].date); want-- }
  }
  for (const d of active) if (d.cls === 'rest') d.cls = 'easy'
  // HARD weekly training-days cap (JM #454): rest the lowest-load days until within the cap.
  if (trainingDays > 0) {
    const training = days.filter((d) => d.cls !== 'rest').sort((a, b) => a.tss - b.tss)
    let over = training.length - trainingDays
    for (let i = 0; i < training.length && over > 0; i++) {
      if (training[i].cls === 'easy') { training[i].cls = 'rest'; training[i].tss = 0; over-- }
    }
  }
  return days
}

// --- sport assignment: rotate the athlete's endurance sports; long → primary; gym ~1×/wk on an easy day ---
function assignSports(weekDays, sports, rotateSeed = 0) {
  const endur = ['cycling', 'running'].filter((s) => sports.includes(s))
  const primary = endur[0] || sports.find((s) => s !== 'gym') || 'cycling'
  const hasGym = sports.includes('gym') || sports.includes('strength')
  let rot = rotateSeed
  // one gym slot/week: the lowest-load EASY day becomes gym (strength around, not stacked on, quality).
  if (hasGym) {
    const easy = weekDays.filter((d) => d.cls === 'easy').sort((a, b) => a.tss - b.tss)
    if (easy[0]) easy[0].sport = 'gym'
  }
  for (const d of weekDays) {
    if (d.cls === 'rest') { d.sport = null; continue }
    if (d.sport === 'gym') continue
    if (d.cls === 'long') { d.sport = primary; continue }
    d.sport = endur.length ? endur[rot++ % endur.length] : primary
  }
  return weekDays
}

const DAYTYPE = { cycling: 'ride', running: 'run', gym: 'gym', strength: 'gym' }
const zoneTitle = (zoneKey, sport) => {
  const z = ZONES[zoneKey]
  const noun = sport === 'cycling' ? 'ride' : sport === 'running' ? 'run' : 'session'
  return z ? `${z.name} ${noun}` : noun
}

// --- ORCHESTRATOR: full 14-day skeleton --------------------------------------------------------------
// opts: { today, days=14, sports, trainingDays, restDows, ctl, loadPlan(blocks), atl }
// Returns { days: [{date,dow,cls,dayType,sport,zone,targetTss,durationMin,segments,title}], blocks, dailyTss, formEnd }
export function generatePlanSkeleton(opts = {}) {
  const { today, days = 14, sports = ['cycling'], trainingDays = 0, restDows, ctl, loadPlan, atl } = opts
  if (!today) return { days: [], blocks: [], dailyTss: {} }
  const from = today, to = addDays(today, days - 1)
  const rest = restDows && restDows.length ? restDows : recentRestDows({})
  const blocks = (Array.isArray(loadPlan) && loadPlan.length) ? loadPlan : defaultLoadPlan(ctl, isoMonday(today))
  const dailyTss = periodizedLoads(from, to, blocks, { restDows: rest })
  // phase for a given date = the phase of its week's block (nearest prior weekStart).
  const phaseFor = (date) => { const mon = isoMonday(date); let ph = 'base'; for (const b of (blocks || [])) if (b.weekStart <= mon) ph = b.phase || ph; return ph }

  // group the horizon into Mon–Sun weeks (only the dates inside [from..to]).
  const byWeek = {}
  for (let d = from; d <= to; d = addDays(d, 1)) { const k = isoMonday(d); (byWeek[k] = byWeek[k] || []).push(d) }
  const weekKeys = Object.keys(byWeek).sort()

  const out = []
  weekKeys.forEach((wk, wi) => {
    const weekDates = byWeek[wk]
    const days = classifyWeek(weekDates, dailyTss, trainingDays)
    assignSports(days, sports, wi)
    // #516c — POLARIZE the week (Seiler hard-easy): periodizedLoads weekend-boosts BOTH weekend days equally,
    // so an unchecked "easy" Sunday landed as heavy as the long Saturday. Cap each easy day at 0.7× the long
    // day, then RE-CONCENTRATE the trimmed load onto the HARD days (quality first, then the long day) so the
    // weekly budget — and the green Form target — is preserved while easy days stay genuinely easy.
    const longTss0 = Math.max(0, ...days.map((d) => d.tss))
    let trimmed = 0
    for (const d of days) if (d.cls === 'easy' && longTss0 > 0) { const c = Math.min(d.tss, Math.round(0.7 * longTss0)); trimmed += d.tss - c; d.tss = c }
    for (const q of days) { if (trimmed <= 0) break; if (q.cls !== 'quality') continue; const add = Math.min(trimmed, 120 - q.tss); if (add > 0) { q.tss += add; trimmed -= add } }
    const lDay = days.find((d) => d.cls === 'long')
    if (lDay && trimmed > 0) { const add = Math.min(trimmed, 150 - lDay.tss); if (add > 0) { lDay.tss += add; trimmed -= add } }
    let qCount = 0
    for (const d of days) {
      if (d.cls === 'rest' || !d.sport) { out.push({ date: d.date, dow: dow(d.date), cls: 'rest', dayType: 'rest', sport: null, zone: null, targetTss: 0, durationMin: 0, segments: [], title: 'Rest' }); continue }
      let t = d.tss
      const phase = phaseFor(d.date)
      const dayType = DAYTYPE[d.sport] || 'ride'
      if (dayType === 'gym') { out.push({ date: d.date, dow: dow(d.date), cls: d.cls, dayType, sport: 'gym', zone: null, targetTss: Math.round(t) || 0, durationMin: 45, segments: [], title: 'Strength session' }); continue }
      const qi = d.cls === 'quality' ? qCount++ : 0
      const zoneKey = suggestIntensityZone(d.cls, phase, qi, wi)
      const built = zoneKey ? buildWorkoutSegments(zoneKey, t) : { segments: [], durationMin: 0, tss: 0 }
      out.push({ date: d.date, dow: dow(d.date), cls: d.cls, dayType, sport: d.sport, zone: zoneKey, targetTss: Math.round(t) || 0, durationMin: built.durationMin, segments: built.segments, title: zoneTitle(zoneKey, d.sport) })
    }
  })

  // Form forecast over the planned loads (optional sanity: does the block land in the green zone?)
  let formEnd = null
  if (ctl != null && atl != null) {
    const loads = out.map((d) => d.targetTss || 0)
    const series = projectFormSeries({ ctl, atl }, loads)
    formEnd = series.length ? Math.round(series[series.length - 1].form) : null
  }
  return { days: out, blocks, dailyTss, formEnd }
}
