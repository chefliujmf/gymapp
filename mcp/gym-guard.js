// #168 — HARD gates for coach-generated gym workouts.
//
// The coach is INSTRUCTED (coach-engine.md + the create_workout tool description) to build every
// strength session with a warm-up + cool-down, the main set grouped by equipment, and every
// single-side move written for BOTH sides. Instruction alone drifted, so create_workout REJECTS a
// non-compliant plan with an actionable message — the coach then re-authors it that same turn.
//
// Scope: this guards the COACH path only (the MCP tool). The UI's manual quick-add (a single lift,
// a saved template) intentionally skips this — a person adding one exercise shouldn't be blocked.
//
// Pure + unit-tested (src/gym-guard.test.ts). No I/O.

// Inherently single-side movements — must be prescribed both sides (per coach-engine.md).
// Kept conservative (unambiguous unilateral moves) to avoid false rejects on bilateral work.
const UNILATERAL = [
  'pallof', 'split squat', 'bulgarian', 'single-arm', 'single arm', 'one-arm', 'one arm',
  'single-leg', 'single leg', 'one-leg', 'one leg', 'side plank', 'suitcase', 'copenhagen',
  'staggered stance', 'b-stance', 'kickstand', 'single-sided', 'unilateral',
]

const sectionOf = (x) => (x && (x.section === 'warmup' || x.section === 'cooldown') ? x.section : 'main')

export function isUnilateral(name) {
  const n = String(name || '').toLowerCase()
  return UNILATERAL.some((u) => n.includes(u))
}

// A single-side move is "OK" if it carries the eachSide flag, names an explicit side (L/R rows),
// or its text spells out a per-side / both-sides dose.
export function eachSideSatisfied(ex) {
  if (!ex) return false
  if (ex.eachSide === true) return true
  const t = `${ex.name || ''} ${ex.reps || ''} ${ex.tip || ''} ${ex.notes || ''}`.toLowerCase()
  return /each side|per side|both sides|each leg|each arm|per leg|per arm|left\/right|\bl\/r\b|left and right|both legs|both arms|\bleft\b|\bright\b/.test(t)
}

// Returns null when the workout is compliant, otherwise a coach-facing rejection message
// listing EVERY issue so it can be fixed in one re-call.
export function validateGymWorkout(exercises) {
  const exs = Array.isArray(exercises) ? exercises : []
  const issues = []
  if (!exs.some((x) => sectionOf(x) === 'warmup'))
    issues.push('Missing WARM-UP. Add 2-4 individual moves tagged section:"warmup" (search_exercises: arm circles, leg swings, band pull-apart, cat-cow, glute bridge…). One move per entry — never "Warm-up: A, B, C" on one line.')
  if (!exs.some((x) => sectionOf(x) === 'cooldown'))
    issues.push('Missing COOL-DOWN. Add 2-3 individual moves tagged section:"cooldown" (targeted stretch / mobility for what you trained, child\'s pose…).')
  const bad = [...new Set(exs.filter((x) => sectionOf(x) !== 'warmup' && isUnilateral(x.name) && !eachSideSatisfied(x)).map((x) => x.name))]
  if (bad.length)
    issues.push(`Single-side move(s) not prescribed for both sides: ${bad.join(', ')}. Set eachSide:true (renders "each side") or write explicit left/right entries so total volume is unambiguous.`)
  if (!issues.length) return null
  return 'Gym workout rejected — fix these and re-call create_workout with the SAME id:\n- ' + issues.join('\n- ')
}
