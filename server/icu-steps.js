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
