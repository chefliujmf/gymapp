// #636 — CODE-DRIVEN gym variety + muscle-group BALANCE. Gym was one #620 behind endurance: its variety was
// prompt-only (a rotation list + a look-back), the exact combo #620 proved the LLM ignores — so the same lifts
// recurred, patterns were dropped, and ARMS were never even in the menu → biceps/triceps never appeared.
//
// Same fix as archetypes.js for endurance: decide it in CODE. Assign the week's movement-pattern coverage (every
// group INCLUDING arms + carry), keep the 1-3 MAIN compound lifts stable (so progress is trackable — JM's balance:
// "not a million exercises, need to compare progress"), and rotate the ACCESSORIES to a fresh option (skip recent,
// anti-boredom). Pure + unit-tested (src/gym-split.test.ts).

// Movement patterns → an ordered ACCESSORY rotation menu each. Arms + carry included (they were the gap).
const PATTERNS = {
  squat:  ['Goblet Squat', 'Back Squat', 'Front Squat', 'Bulgarian Split Squat', 'Leg Press', 'Walking Lunge'],
  hinge:  ['Romanian Deadlift', 'Deadlift', 'Hip Thrust', 'Single-Leg RDL', 'Good Morning', 'Kettlebell Swing'],
  hpush:  ['Dumbbell Bench Press', 'Barbell Bench Press', 'Push-Up', 'Incline Dumbbell Press', 'Floor Press'],
  vpush:  ['Seated Dumbbell Shoulder Press', 'Overhead Press', 'Arnold Press', 'Landmine Press', 'Pike Push-Up'],
  hpull:  ['Dumbbell Row', 'Barbell Row', 'Chest-Supported Row', 'Cable Row', 'Inverted Row'],
  vpull:  ['Lat Pulldown', 'Pull-Up', 'Chin-Up', 'Assisted Pull-Up', 'Straight-Arm Pulldown'],
  core:   ['Plank', 'Pallof Press', 'Dead Bug', 'Hanging Knee Raise', 'Ab Wheel', 'Side Plank'],
  arms:   ['Dumbbell Biceps Curl', 'Triceps Pushdown', 'Hammer Curl', 'Overhead Triceps Extension', 'Incline Curl', 'Skull Crusher'],
  carry:  ['Farmer Carry', 'Suitcase Carry', 'Front-Rack Carry', 'Overhead Carry'],
}
export const GYM_PATTERNS = Object.keys(PATTERNS)
const LABEL = { squat: 'Squat', hinge: 'Hinge', hpush: 'Horizontal push', vpush: 'Vertical push (shoulders)', hpull: 'Horizontal pull', vpull: 'Vertical pull', core: 'Core', arms: 'ARMS (biceps + triceps)', carry: 'Loaded carry' }

// map an exercise NAME → its movement pattern (the look-back fingerprint, gym analogue of keyFromTitle).
export function patternFromExercise(name) {
  const n = String(name || '').toLowerCase()
  if (/curl|tricep|skull ?crush|pushdown|close.?grip/.test(n)) return 'arms'
  if (/carry|farmer|suitcase/.test(n)) return 'carry'
  if (/plank|pallof|dead ?bug|ab wheel|knee raise|hollow|bird.?dog/.test(n)) return 'core'
  if (/pull.?up|pull.?down|chin.?up|straight.?arm/.test(n)) return 'vpull'
  if (/\brow\b|face pull/.test(n)) return 'hpull'
  if (/overhead press|shoulder press|arnold|landmine|pike push/.test(n)) return 'vpush'
  if (/bench|push.?up|chest press|floor press|dip/.test(n)) return 'hpush'
  if (/deadlift|hip thrust|swing|good ?morning|hinge|glute bridge/.test(n)) return 'hinge'
  if (/squat|lunge|leg press|step.?up|split squat/.test(n)) return 'squat'
  return null
}

// #637 — the SPLIT depends on FREQUENCY + FOCUS + sport (evidence-based, Schoenfeld 2016: each muscle ~2×/week is the
// hypertrophy sweet spot; 1× maintains). A 1×/week endurance athlete gets FULL-BODY (cover everything in the one
// session); a 4×/week lifter gets a real SPLIT (upper/lower or PPL) so each muscle is hit ~2×/week without full-body
// every day. This picks the split + the per-session pattern list, so a bodybuilder isn't full-bodied and a cyclist
// isn't split into a half-covered week.
function pickSplit(spw, hyper) {
  if (spw <= 2 || (!hyper && spw <= 3)) {
    // ≤2 sessions, or endurance-SUPPORT up to 3 → FULL-BODY each session (compound-led, cover the big patterns + arms)
    return { name: 'FULL-BODY each session', days: Array.from({ length: spw }, () => GYM_PATTERNS.slice()) }
  }
  if (spw >= 5 && hyper) {
    const push = ['hpush', 'vpush', 'arms', 'core'], pull = ['hpull', 'vpull', 'arms', 'core'], legs = ['squat', 'hinge', 'core', 'carry']
    const cyc = [push, pull, legs]
    return { name: 'PUSH / PULL / LEGS (×2 → each muscle ~2×/week)', days: Array.from({ length: spw }, (_, i) => cyc[i % 3]) }
  }
  // 3-4 hypertrophy → UPPER / LOWER so each muscle lands ~2×/week
  const upper = ['hpush', 'vpush', 'hpull', 'vpull', 'arms', 'core'], lower = ['squat', 'hinge', 'core', 'carry']
  return { name: 'UPPER / LOWER (each muscle ~2×/week)', days: Array.from({ length: spw }, (_, i) => (i % 2 === 0 ? upper : lower)) }
}

/**
 * Assign the week's gym split + balance.
 * @param {object} p
 *   sessionsPerWeek  how many gym sessions/week (drives full-body vs split)
 *   focus            'support' | 'maintenance' | 'hypertrophy' | 'muscle' | 'strength' | 'power' (from GYM FOCUS)
 *   recentExercises  names from recent gym sessions (rotate accessories fresh)
 * @returns {{ spw, splitName, days: string[][], rotations, mustCover, arms:true }}
 *   days: the pattern list for each session this week; splitName: the chosen split; rotations: a fresh accessory
 *   per pattern (skip-recent). ARMS appear in every full-body / upper / push / pull day — never dropped.
 */
export function assignWeeklyGym({ sessionsPerWeek = 1, focus = 'support', recentExercises = [] } = {}) {
  const spw = Math.max(1, Math.min(7, Math.round(Number(sessionsPerWeek) || 1)))
  const hyper = /hypertroph|muscle|body ?build|physique|\bmass\b|bodybuild/.test(String(focus || '').toLowerCase())
  const { name: splitName, days } = pickSplit(spw, hyper)
  const recent = new Set((recentExercises || []).map((e) => String(e || '').toLowerCase().trim()))
  const rotations = {}
  for (const pat of GYM_PATTERNS) { const menu = PATTERNS[pat]; rotations[pat] = menu.find((m) => !recent.has(m.toLowerCase())) || menu[0] }
  return { spw, splitName, days, rotations, mustCover: GYM_PATTERNS.slice(), arms: true }
}

// render the assignment for the prompt block: the split + each session's patterns (with a fresh accessory each).
export function gymBalanceLines(assign) {
  const perSession = assign.days.map((pats, i) => `Session ${i + 1}: ${pats.map((p) => `${LABEL[p] || p} (e.g. ${assign.rotations[p]})`).join(' · ')}`).join('\n')
  return `Split = ${assign.splitName} (${assign.spw} gym session${assign.spw !== 1 ? 's' : ''}/week).\n${perSession}`
}
