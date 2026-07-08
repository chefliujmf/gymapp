// Structured workout steps for intervals.icu, shared + unit-tested (src/icu-steps.test.ts).
//
// #312/#314 — a RUN must target PACE, not power. intervals renders a step's target by its KEY:
// `power:{units:'%ftp'}` → watts, `pace:{units:'%pace'}` → pace (% of threshold pace). We author
// run segments as "% of threshold" (same numbers the coach picks); the ONLY fix is emitting them
// under `pace` for runs so intervals — and the Garmin workout it syncs — shows pace, never watts.
export const MAX_DOC_STEP_SECONDS = 3600

// #331/#336/#343 — the coach authors intensity as effort-% off threshold; running PACE does NOT scale
// like power. These anchors are DERIVED FROM THE DANIELS FOUNDATIONS, not hand-guessed: each zone's pace
// as a % of THRESHOLD SPEED, computed from the oxygen-cost curves in running-paces.ts and stable across
// VDOT (40/48/55 all agree ±0.5%). Recovery(59% VO₂max)≈73%T · Easy(65–74%)≈78–87%T · Marathon≈94%T ·
// Threshold=100%T · Interval(100% VO₂max)≈111%T · Rep(108%)≈118%T. Effort-% (x) → pace-% of threshold (y).
// KEEP IN SYNC with src/running-paces.ts PACE_ANCHORS.
const PACE_ANCHORS = [[20, 70], [30, 73], [40, 77], [55, 81], [65, 84], [75, 89], [85, 93], [95, 98], [100, 100], [108, 111], [120, 119]]
export function paceFromPowerPct(p) {
  const n = Number(p) || 0
  if (n <= PACE_ANCHORS[0][0]) return PACE_ANCHORS[0][1]
  if (n >= PACE_ANCHORS[PACE_ANCHORS.length - 1][0]) return PACE_ANCHORS[PACE_ANCHORS.length - 1][1]
  for (let i = 1; i < PACE_ANCHORS.length; i++) {
    if (n <= PACE_ANCHORS[i][0]) { const [x0, y0] = PACE_ANCHORS[i - 1], [x1, y1] = PACE_ANCHORS[i]; return Math.round(y0 + (y1 - y0) * (n - x0) / (x1 - x0)) }
  }
  return 85
}

// #331c — HARD sanity guard (JM: "95% is NEVER easy, for ANY sport"). A segment LABELLED easy/recovery/
// warm-up/cool-down/jog/spin must NOT be prescribed near threshold. The coach sometimes fat-fingers a
// high % (e.g. a "Recovery Run" at 94% → threshold effort). Clamp any easy-INTENT segment above the easy
// ceiling down to a real easy/recovery effort — for BOTH runs (% threshold pace) and rides (% FTP), since
// the number means the same "fraction of threshold" in each. Intentional work (tempo/threshold/intervals/
// strides) is left untouched — only easy-labelled segments are capped. Pure + unit-tested.
const EASY_LABEL = /\b(recover\w*|shake ?out|warm[ -]?up|cool[ -]?down|easy|jog|z1|z2|spin|aerobic base)\b/i
const RECOVERY_LABEL = /\b(recover\w*|shake ?out|z1|walk)\b/i
const EASY_CEILING = 80 // above this, an "easy" label is a mistake
export function clampEasyEfforts(title = '', segments = []) {
  const titleEasy = EASY_LABEL.test(String(title))
  const titleRecovery = RECOVERY_LABEL.test(String(title))
  let clamped = 0
  const out = (segments || []).map((s) => {
    const label = String(s.label || '')
    const easy = label ? EASY_LABEL.test(label) : titleEasy // a segment's own label wins; unlabelled inherits the title
    if (!easy) return s
    const ps = Number(s.powerStart) || 0, pe = s.powerEnd != null ? Number(s.powerEnd) : ps
    if (Math.max(ps, pe) <= EASY_CEILING) return s // already easy — leave the ramp/values as authored
    const cap = (RECOVERY_LABEL.test(label) || titleRecovery) ? 35 : 55 // recovery → Z1, plain easy → Z2
    clamped++
    return { ...s, powerStart: cap, powerEnd: cap }
  })
  return clamped ? { segments: out, clamped } : { segments, clamped: 0 }
}

// #384 — normalize ramp DIRECTION so intervals never shows a confusing "high-low" range. A COOL-DOWN
// that ramps 58%→45% renders as "150-117 W", which reads like a backwards range — JM's pick was to make
// cool-downs a FLAT easy spin (single value, the eased-down power). WARM-UPS always ramp UP (low→high).
// Work/steady segments are left exactly as authored (a real over-under / progressive ramp is intentional).
export function normalizeRamps(segments = []) {
  return (segments || []).map((s) => {
    const ps = Number(s.powerStart) || 0
    const pe = s.powerEnd != null ? Number(s.powerEnd) : ps
    const label = String(s.label || '')
    if (/cool[ -]?down/i.test(label)) { const v = Math.min(ps, pe) || ps || pe; return { ...s, powerStart: v, powerEnd: v } }
    if (/warm[ -]?up/i.test(label) && pe < ps) return { ...s, powerStart: pe, powerEnd: ps }
    return s
  })
}

// Encode ONE plan segment (powerStart/powerEnd = % of FTP for rides, % of threshold pace for runs)
// into intervals workout_doc step(s). Splits a step longer than MAX into interpolated chunks — a
// single over-long step makes the intervals workout render EMPTY (matches cyclingcoach split_long_doc_step).
export function encodeStep(s, isRun = false) {
  const dur = Number(s.duration) || 0, ps = Number(s.powerStart) || 0, pe = Number(s.powerEnd) || 0
  const target = (a, b) => isRun
    ? { pace: { start: Math.round(a), end: Math.round(b), units: '%pace' } }
    : { power: { start: Math.round(a), end: Math.round(b), units: '%ftp' } }
  const mk = (d, a, b, withText) => ({ duration: d, ...target(a, b), ...(s.label && withText ? { text: s.label } : {}) })
  if (dur <= MAX_DOC_STEP_SECONDS) return [mk(dur, ps, pe, true)]
  const n = Math.ceil(dur / MAX_DOC_STEP_SECONDS), size = Math.round(dur / n)
  const chunks = []; let elapsed = 0
  for (let i = 0; i < n; i++) {
    const d = i === n - 1 ? dur - elapsed : size
    chunks.push(mk(d, ps + (pe - ps) * (elapsed / dur), ps + (pe - ps) * ((elapsed + d) / dur), i === 0))
    elapsed += d
  }
  return chunks
}

// Coggan power zones → representative %FTP (mirrors src/intervals.ts stepPctFtp). intervals emits
// {units:'power_zone', value:N} steps — without this they collapse to 0 / a bogus % (the "5 W" bug).
const ZONE_PCT = { 1: 50, 2: 65, 3: 83, 4: 98, 5: 113, 6: 135, 7: 160 }
export function resolveStepPct(p) {
  if (!p) return { start: 0, end: 0 }
  if (p.units === 'power_zone') {
    const z = Math.round(p.value || 0)
    const pct = ZONE_PCT[z] != null ? ZONE_PCT[z] : (p.value >= 20 ? p.value : 65)
    return { start: pct, end: pct, label: z >= 1 && z <= 7 ? `Z${z}` : undefined }
  }
  return { start: (p.start != null ? p.start : p.value) || 0, end: (p.end != null ? p.end : p.value) || 0 }
}

// #157 — render segments as a NATIVE intervals workout (Warmup / Nx repeats / Cooldown) so the pushed
// text reads like a hand-built workout, not a flat "## Workout" list. Rides also carry a workout_doc (the
// chart authority); RUNS parse THIS text, so each step keeps its "- Xm Y% pace" target (round-trip verified:
// intervals parses "2x" + "% pace" into a repeat block with pace targets). Pure + unit-tested.
const segSig = (s) => `${Number(s.duration) || 0}|${Number(s.powerStart) || 0}|${s.powerEnd != null ? Number(s.powerEnd) : Number(s.powerStart) || 0}`
/** Smallest unit that tiles `work` a whole number of times → { reps, unit }; else null. */
export function detectRepeat(work) {
  const n = work.length
  for (let u = 1; u <= n / 2; u++) {
    if (n % u !== 0) continue
    let ok = true
    for (let i = u; i < n; i++) if (segSig(work[i]) !== segSig(work[i % u])) { ok = false; break }
    if (ok) return { reps: n / u, unit: work.slice(0, u) }
  }
  return null
}
export function nativeWorkoutText(segs, isRun) {
  if (!segs || !segs.length) return ''
  const durTxt = (secs) => (secs >= 60 && secs % 60 === 0 ? `${secs / 60}m` : `${secs}s`)
  const step = (s) => {
    const secs = Number(s.duration) || 0, a = Number(s.powerStart) || 0, b = s.powerEnd != null ? Number(s.powerEnd) : a
    const tgt = isRun ? `${paceFromPowerPct(Math.round((a + b) / 2))}% pace` : (a === b ? `${a}%` : `${a}-${b}%`)
    return `- ${durTxt(secs)} ${tgt}${s.label ? ' ' + s.label : ''}`
  }
  const isWarm = (s) => /warm/i.test(s.label || ''), isCool = (s) => /cool/i.test(s.label || '')
  let w = 0, c = segs.length
  while (w < segs.length && isWarm(segs[w])) w++
  if (w === 0 && Number(segs[0].powerEnd) > Number(segs[0].powerStart)) w = 1 // unlabelled leading ramp = warm-up
  while (c > w && isCool(segs[c - 1])) c--
  const warm = segs.slice(0, w), work = segs.slice(w, c), cool = segs.slice(c)
  const L = []
  if (warm.length) L.push('Warmup', ...warm.map(step))
  if (work.length) {
    const rep = work.length > 1 ? detectRepeat(work) : null
    if (rep && rep.reps > 1) L.push('', `${rep.reps}x`, ...rep.unit.map(step))
    else L.push(warm.length ? '' : null, ...work.map(step))
  }
  if (cool.length) L.push('', 'Cooldown', ...cool.map(step))
  return L.filter((x) => x !== null).join('\n')
}

// EXPAND nested repeat blocks ({reps, steps:[…]}) into individual segments (#293). Reads a step's
// PACE target (runs) or POWER target (rides) — whichever intervals sent — so a run round-trips
// without collapsing to 0 (#312).
export function flattenIcuStepsSrv(steps = []) {
  const out = []
  const walk = (s) => {
    if (s.steps && s.reps) { for (let i = 0; i < s.reps; i++) s.steps.forEach(walk) }
    else if (s.steps) { s.steps.forEach(walk) }
    else if (s.duration) { const pr = resolveStepPct(s.pace || s.power); out.push({ duration: Number(s.duration) || 0, powerStart: Number(pr.start) || 0, powerEnd: Number(pr.end) || 0, ...(s.text ? { label: s.text } : pr.label ? { label: pr.label } : {}) }) }
  }
  for (const s of steps) walk(s)
  return out
}

// #372 — planned TSS from segments. intervals does NOT compute planned load for EXTERNALLY-created (API)
// workouts (only for ones built in its own planner) — verified: valid %ftp workout_doc + FTP 260, yet
// icu_training_load stays null → Form projects FLAT despite a hard week. So we compute the standard Coggan
// TSS and hand it to intervals via icu_training_load; intervals then does the Form/CTL/ATL out-of-the-box.
// FTP-INDEPENDENT: a %FTP / %threshold workout's TSS depends only on the percentages (the % IS the IF), so
// no FTP lookup is needed — mirrors the client's `plannedLoad` (workout-summary.ts).
// #378 — the "Open in Platyplus" deep-link is REGENERATED on every push, so it must NEVER be persisted in
// plan.notes. If it leaks in (reconcile imported a pushed event's description back into notes), the next push
// prepends ANOTHER → they accumulate; cross-env (QA + prod share the athlete) you get one prod + one QA link.
// Strip any such line wherever notes are composed or imported. Pure + unit-tested.
export function stripPlatyplusLinks(s) {
  return String(s || '').replace(/^.*Open workout in Platyplus.*$/gim, '').replace(/\n{3,}/g, '\n\n').trim()
}

// #388 — the native workout TEXT (Warmup / Nx / "- 12m 90% Sweet Spot" / Cooldown) is REGENERATED on every
// push from the segments, so — like the deep-link (#378) — it must NEVER be persisted in plan.notes. When
// reconcile imported a pushed event's description back into notes, the native block leaked in; the next push
// then wrote native + (native-in-notes) → the workout appeared TWICE in intervals (a 1h ride rendered ~2h).
// Strip the derived block wherever notes are composed or imported. Only removes lines that are unmistakably
// workout steps (a duration + a %/pace target) or section/repeat headers — real prose notes are untouched.
export function stripDerivedWorkout(s) {
  return String(s || '')
    .replace(/^\s*(warmup|cooldown|cool-?down|warm-?up)\s*$/gim, '') // section headers
    .replace(/^\s*\d+\s*x\s*$/gim, '')                               // repeat header e.g. "2x"
    .replace(/^\s*-\s*\d+\s*[ms]\b.*?(%|pace|watts?|\bw\b).*$/gim, '') // "- 15m 90% Sweet Spot" / "- 30s 110% pace"
    .replace(/^\s*##?\s*workout.*$/gim, '')                          // legacy "## Workout" header
    .replace(/\n{3,}/g, '\n\n').trim()
}

export function plannedTss(segments = []) {
  const segs = (segments || []).filter((x) => x && Number(x.duration) > 0)
  if (!segs.length) return null
  const totalSec = segs.reduce((a, x) => a + (Number(x.duration) || 0), 0)
  const w = [] // 10s samples of the target intensity % (interpolate ramps)
  for (const s of segs) {
    const dur = Math.round(Number(s.duration) || 0)
    const p0 = Number(s.powerStart) || 0, p1 = s.powerEnd != null ? Number(s.powerEnd) : p0
    const n = Math.max(1, Math.round(dur / 10))
    for (let i = 0; i < n; i++) { const f = n > 1 ? i / (n - 1) : 0; w.push(p0 + (p1 - p0) * f) }
  }
  let sum4 = 0, cnt = 0 // NP% = 4th-root of the mean of the 30s rolling avg^4; IF = NP% / 100
  for (let i = 0; i < w.length; i++) { const a = w.slice(Math.max(0, i - 2), i + 1); const avg = a.reduce((x, y) => x + y, 0) / a.length; sum4 += Math.pow(avg, 4); cnt++ }
  const IF = (cnt ? Math.pow(sum4 / cnt, 0.25) : 0) / 100
  return { if: Math.round(IF * 100) / 100, tss: Math.round((totalSec * IF * IF) / 3600 * 100) }
}

// #434 — a GYM plan carries no segments, so plannedTss returns null and intervals gets Load 0 (its Form/CTL
// then IGNORES strength work). Estimate the gym LOAD the way the app estimates gym MINUTES (sets × reps×tempo
// + rest + per-move setup + warm-up — mirror of src/plan.ts estimateGymMinutes), then apply the KB's Friel
// weightlifting factor. #81: ~45 TSS/h "standard" is the planned default; a post-session RPE refines it
// (TSS/h ≈ 8 + RPE×6, src/tss.ts gymTSSfromRPE). Pure + unit-tested.
function gymTempoSec(tempo) { const s = String(tempo || '').split('-').map(Number).filter((n) => !isNaN(n)).reduce((a, b) => a + b, 0); return s > 0 ? s : 4 }
export function estimateGymSeconds(plan) {
  const exs = (plan && plan.exercises) || []
  if (!exs.length) return 0
  let sec = 0
  for (const x of exs) {
    const sets = Number(x.sets) > 0 ? Number(x.sets) : 3
    const rest = x.rest != null && Number(x.rest) >= 0 ? Number(x.rest) : 60
    const work = (x.mode || 'reps') === 'timed'
      ? (Number(x.seconds) > 0 ? Number(x.seconds) : 40)
      : (Number(x.reps) > 0 ? Number(x.reps) : 10) * gymTempoSec(x.tempo)
    sec += sets * work + sets * rest + 20
  }
  sec *= (Number(plan.rounds) > 0 ? Number(plan.rounds) : 1)
  sec += 5 * 60
  return Math.round(sec)
}
export function plannedGymTss(plan) {
  const min = estimateGymSeconds(plan) / 60
  if (min < 5) return 0
  const PER_HOUR = 45 // KB (Friel): standard hypertrophy/maintenance ≈ 45 TSS/h. #81 refines by prescribed effort.
  return Math.max(1, Math.round((min / 60) * PER_HOUR))
}

// #414 — did PLATYPLUS push this intervals event? Every event we create carries `external_id = <plan id>`
// (composeIcuEvent), and gym events also carry the "Open workout in Platyplus" deep-link. Athlete-created
// events (from the intervals calendar, a watch, or Strava-planned) have NEITHER. This is the SAFETY-CRITICAL
// gate for the orphan GC (reconcileFromIcu, #414): an event we pushed that no plan claims is a leftover to
// delete; an athlete's own event must NEVER match. Pure + unit-tested.
export function isPlatyplusPushedEvent(ev) {
  if (!ev || typeof ev !== 'object') return false
  if (ev.external_id != null && String(ev.external_id).trim() !== '') return true
  return ev.type === 'WeightTraining' && /Open workout in Platyplus/i.test(ev.description || '')
}
