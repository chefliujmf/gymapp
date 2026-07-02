// Structured workout steps for intervals.icu, shared + unit-tested (src/icu-steps.test.ts).
//
// #312/#314 — a RUN must target PACE, not power. intervals renders a step's target by its KEY:
// `power:{units:'%ftp'}` → watts, `pace:{units:'%pace'}` → pace (% of threshold pace). We author
// run segments as "% of threshold" (same numbers the coach picks); the ONLY fix is emitting them
// under `pace` for runs so intervals — and the Garmin workout it syncs — shows pace, never watts.
export const MAX_DOC_STEP_SECONDS = 3600

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
