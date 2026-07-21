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

/**
 * Assign the week's gym BALANCE.
 * @param {object} p
 *   focus            'support' | 'maintenance' | 'hypertrophy' | 'strength' | 'power' | ... (from GYM FOCUS)
 *   recentExercises  names from the athlete's recent gym sessions (to rotate accessories fresh)
 * @returns {{ mustCover: string[], rotations: {pattern: freshAccessory}, arms: boolean }}
 *   mustCover: the movement patterns to hit ACROSS this week — ALWAYS includes arms + carry (the coverage guarantee);
 *   rotations: a fresh accessory per pattern (skips anything in recentExercises), anti-boredom while mains stay stable.
 */
export function assignWeeklyGym({ focus = 'support', recentExercises = [] } = {}) {
  // full coverage every week — arms + carry are NON-optional (that was the miss). Volume/sets per pattern is the
  // coach's + GYM FOCUS's job; this guarantees the PATTERNS (incl. arms) are present, not the set count.
  const mustCover = GYM_PATTERNS.slice()
  const recent = new Set((recentExercises || []).map((e) => String(e || '').toLowerCase().trim()))
  const rotations = {}
  for (const pat of mustCover) {
    const menu = PATTERNS[pat]
    rotations[pat] = menu.find((m) => !recent.has(m.toLowerCase())) || menu[0] // first FRESH option, else the head
  }
  return { mustCover, rotations, arms: true }
}

// render the assignment as the prompt block body (label + the fresh accessory per pattern).
export function gymBalanceLines(assign) {
  return assign.mustCover.map((pat) => `${LABEL[pat] || pat}: e.g. ${assign.rotations[pat]}`).join(' · ')
}
