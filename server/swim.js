// #715 (audit) — SWIM intensity, made first-class + CLAMPABLE like ride/run. Swim is distance sets on a send-off,
// coached by CSS zone (not %-of-threshold time-segments) — so the coach's create_swim sends the STRUCTURED sets and the
// SERVER owns the math here: it (a) CLAMPS each set's zone to the week-shape ceiling (a maintenance / pregnant / teen
// swimmer physically can't be saved a Z5 sprint set), then (b) re-derives the display notes + duration + distance + sTSS
// from the CLAMPED sets. This closes the critical no-op where swim intensity was free text the clamp never touched.
// Pure + unit-tested. The zone→IF math + notes format MATCH the original create_swim (mcp/server.js) exactly.
export const SWIM_ZONE_IF = { 1: 0.72, 2: 0.85, 3: 1.0, 4: 1.06, 5: 1.16 } // % of CSS speed → IF for sTSS
export const SWIM_ZONE_LABEL = { 1: 'Z1 easy', 2: 'Z2 aerobic', 3: 'CSS', 4: 'Z4 race-pace', 5: 'Z5 sprint' }

// the week-shape intensity CEILING → the hardest swim zone allowed. endurance/tempo (maintenance/pregnancy/teen) cap at
// aerobic Z2; sweetspot/threshold allow CSS Z3; a full build (vo2) allows sprint Z5. Mirrors CEILING_PCT for ride/run.
export function ceilingToSwimZone(ceiling) {
  return ({ endurance: 2, tempo: 2, sweetspot: 3, threshold: 3, vo2: 5 })[ceiling] != null
    ? ({ endurance: 2, tempo: 2, sweetspot: 3, threshold: 3, vo2: 5 })[ceiling] : 5
}

// clamp every set's zone down to maxZone. Returns the (possibly new) sets + how many were clamped.
export function clampSwimSets(sets, maxZone) {
  const mz = Number(maxZone) > 0 ? Number(maxZone) : 5
  let clamped = 0
  const out = (Array.isArray(sets) ? sets : []).map((s) => {
    const z = Number(s && s.zone) || 2
    if (z > mz) { clamped++; return { ...s, zone: mz } }
    return s
  })
  return { sets: out, clamped }
}

// derive the display NOTES + totals (duration, distance, sTSS) from the sets — EXACTLY as the original create_swim did,
// so a clamped set produces a consistent note + load. css = the athlete's CSS pace in s/100 m (default nominal 100).
export function computeSwim(sets, css) {
  const c = Number(css) > 0 ? Number(css) : 100
  let distM = 0, durS = 0, sTSS = 0
  const lines = { warmup: [], drills: [], main: [], cooldown: [] }
  for (const s of (Array.isArray(sets) ? sets : [])) {
    const reps = Number(s.reps) || 1, z = Number(s.zone) || 2, IF = SWIM_ZONE_IF[z] || 0.85
    const perRepS = (Number(s.distanceM) / 100) * (c / IF)
    distM += reps * Number(s.distanceM)
    durS += reps * (perRepS + (Number(s.restSec) || 0))
    sTSS += (reps * perRepS * IF * IF) / 36
    const sec = lines[s.section] ? s.section : 'main'
    lines[sec].push(`${reps > 1 ? reps + '×' : ''}${s.distanceM}${s.zone ? ' @ ' + (SWIM_ZONE_LABEL[z] || '') : ''}${s.restSec ? ` (${s.restSec}s rest)` : ''}${s.note ? ' — ' + s.note : ''}`)
  }
  const notes = ['warmup', 'drills', 'main', 'cooldown'].filter((k) => lines[k].length).map((k) => `${k[0].toUpperCase() + k.slice(1)}: ${lines[k].join(', ')}`).join('\n')
  return { notes, moving_time: Math.round(durS), distanceM: distM, icu_training_load: Math.round(sTSS) }
}

// the whole enforcement in one call: clamp the sets to the ceiling, then re-derive everything from the clamped sets.
// Returns { sets, clamped, notes, moving_time, distanceM, icu_training_load }.
export function enforceSwim(sets, ceiling, css) {
  const { sets: clamped, clamped: n } = clampSwimSets(sets, ceilingToSwimZone(ceiling))
  return { sets: clamped, clamped: n, ...computeSwim(clamped, css) }
}
