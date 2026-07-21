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

// #648 — CODE-DRIVEN REP SCHEME by GYM FOCUS. The system already decides VOLUME (#534) + BALANCE/VARIETY (#636) in
// code, but the REP/LOAD dimension was prompt-only + vague ("heavy-ish") → the LLM defaulted to 3×10 hypertrophy for
// EVERYONE, incl. a cyclist (wrong: endurance strength = HEAVY, LOW-rep, fast concentric — Rønnestad & Mujika 2014,
// Beattie 2014, Vikmoen 2016 — builds force + economy with minimal mass; 10-rep adds mass, less specific). So decide
// the PRIMARY-lift rep/%1RM/tempo in code per focus and inject it, the same way balance is. Mirror of src/strength.ts
// GYM_FOCUS (keep in sync). Accessories/arms may run moderate regardless.
const REP_SCHEME = {
  support:       { mains: '3-6',  pctLow: 80, pctHigh: 90, tempo: '3-0-1-0', accessories: '8-12', intent: 'HEAVY, drive UP fast/explosively, keep 2-4 reps in reserve — do NOT go to failure; long rests (2-3 min). The point is force + pedalling/stride economy, minimal added mass.' },
  support_build: { mains: '4-6',  pctLow: 75, pctHigh: 87, tempo: '3-0-1-0', accessories: '6-12', intent: 'Heavy mains for strength carry-over + a dosed hypertrophy stimulus on accessories (1-3 reps in reserve), scheduled clear of key sessions.' },
  strength:      { mains: '3-5',  pctLow: 85, pctHigh: 95, tempo: '3-0-1-0', accessories: '6-10', intent: 'Heavy, crisp technique, long rests — intensity over volume, well short of failure.' },
  muscle:        { mains: '6-12', pctLow: 67, pctHigh: 85, tempo: '3-1-1-0', accessories: '8-15', intent: 'Take sets close (1-3 reps in reserve), controlled slower eccentric for time-under-tension, add load/reps over time (progressive overload).' },
  health:        { mains: '8-15', pctLow: 50, pctHigh: 75, tempo: '2-0-1-0', accessories: '10-15', intent: 'Comfortable, full range, all major groups ~2×/week.' },
}
const GYM_FOCUS_KEYS = Object.keys(REP_SCHEME)

// Port of src/strength.ts inferGymFocus (server can't import the TS). MAIN sport is the strongest signal: an endurance
// main sport → SUPPORT (or support_build if they also want muscle), NEVER a hypertrophy default. Keep in sync.
export function resolveGymFocus({ mainSport, sports = [], goal } = {}) {
  const g = String(goal || '').toLowerCase()
  const isEndurance = (s) => /cycl|ride|bike|\brun|jog|swim|tri|endurance|row/.test(s)
  const goalMuscle = /muscle|hypertroph|bigger|\bmass\b|tone up|\bbulk\b|physique|\blean\b/.test(g)
  const goalStrength = /\bstrong|1\s?-?rm|one[- ]rep|deadlift|squat|bench|powerlift/.test(g)
  const goalEndurance = /\bftp\b|watt|\bpace\b|marathon|\brace\b|\bride\b|\brun\b|\bbike\b|cycl|endurance|triathlon|\bvo2\b/.test(g)
  const main = String(mainSport || '').toLowerCase()
  if (main) {
    if (isEndurance(main)) return goalMuscle ? 'support_build' : 'support'
    if (/strength|gym|lift|weight|bodybuild|power/.test(main)) return goalStrength && !goalMuscle ? 'strength' : 'muscle'
  }
  if (goalMuscle) return 'muscle'
  if (goalStrength && !goalEndurance) return 'strength'
  const first = String(sports[0] || '').toLowerCase()
  if (goalEndurance || isEndurance(first)) return 'support'
  if (/strength|gym|lift|weight|bodybuild|power/.test(first)) return 'muscle'
  return 'health'
}

// Normalize any focus input (a resolved key, or a legacy free string) to one of the 5 focus keys.
function normFocus(focus) {
  const f = String(focus || '').toLowerCase()
  if (GYM_FOCUS_KEYS.includes(f)) return f
  if (/hypertroph|muscle|body ?build|physique|\bmass\b|bodybuild/.test(f)) return 'muscle'
  if (/support.?build|lean/.test(f)) return 'support_build'
  if (/strength|1.?rm|power/.test(f)) return 'strength'
  if (/health|general|wellness/.test(f)) return 'health'
  return 'support'
}
export function repSchemeFor(focus) { return REP_SCHEME[normFocus(focus)] }

// #649 — the CODE-ENFORCED half of #648. The rep scheme was only INJECTED into the prompt, so the LLM could still
// save a cyclist 3×10 (the audit's flagship still-open gap). This clamps each MAIN COMPOUND lift's reps into the
// focus's `mains` band at save time (peer to enforceTeenGym). Accessories (arms/core/carry) + warm-up/cool-down are
// left alone — they may run moderate. Pure + unit-tested.
const MAIN_PATTERNS = new Set(['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull'])
export function mainsRepRange(focus) {
  const rs = REP_SCHEME[normFocus(focus)]
  const m = rs && String(rs.mains).match(/(\d+)\s*[-–]\s*(\d+)/)
  return m ? [Number(m[1]), Number(m[2])] : null
}
/** Clamp each MAIN compound lift's reps into the focus rep band. Mutates `exercises`, returns the count changed.
 *  Only the FIRST exercise of each main pattern (the primary compound for that pattern) is a "main" — a SECOND
 *  same-pattern move (e.g. Leg Press after Back Squat) is an ACCESSORY and keeps its reps (may run moderate). This
 *  stops a support cyclist's 12-rep accessory being wrongly clamped to 6 (#663). Arms/core/carry are never mains. */
export function clampMainReps(exercises, focus) {
  const range = mainsRepRange(focus)
  if (!range) return 0
  const [lo, hi] = range
  const seenMainPattern = new Set()
  let n = 0
  for (const ex of (exercises || [])) {
    if (!ex || ex.section === 'warmup' || ex.section === 'cooldown') continue
    if (!(ex.mode === 'reps' || ex.reps != null)) continue
    const pat = patternFromExercise(ex.name)
    if (!MAIN_PATTERNS.has(pat)) continue          // arms/core/carry/unknown → accessory, keep reps
    if (seenMainPattern.has(pat)) continue         // 2nd move of the same pattern → accessory, keep reps
    seenMainPattern.add(pat)
    const r = Number(ex.reps)
    if (!(r > 0)) continue
    if (r > hi) { ex.reps = hi; n++ } else if (r < lo) { ex.reps = lo; n++ }
  }
  return n
}
const LABEL = { squat: 'Squat', hinge: 'Hinge', hpush: 'Horizontal push', vpush: 'Vertical push (shoulders)', hpull: 'Horizontal pull', vpull: 'Vertical pull', core: 'Core', arms: 'ARMS (biceps + triceps)', carry: 'Loaded carry' }

// #658 — SPORT-ADAPTIVE exercise SELECTION. Balance (#636) guarantees full coverage + reps adapt by focus (#648), but
// the MOVEMENTS were sport-blind: a cyclist and a swimmer got identical selection. A world-class coach differentiates
// what to PRIORITIZE + the CORE style per sport (Rønnestad cyclist; Beattie/Blagrove runner plyo/economy; swimming
// S&C shoulder/pull; core = STABILITY not crunches for all endurance). Code-INJECTED (selection is qualitative, not
// a hard clamp) — the emphasis block steers accessory + priority choice while balance still covers everything.
const SPORT_EMPHASIS = {
  cycling: { label: 'cyclist', priority: ['squat', 'hinge'],
    core: 'anti-rotation + anti-extension (Pallof, dead-bug, plank) for power transfer + sustained aero-position endurance — not crunches',
    cue: 'Heavy BILATERAL leg + posterior-chain strength (squat, hinge) is the priority; keep upper-body volume LOW (added mass costs watts/kg); no heavy spinal-fatigue right before a key ride.' },
  running: { label: 'runner', priority: ['squat', 'hinge'],
    core: 'anti-rotation + hip/glute frontal-plane stability (bird-dog, side plank, monster walks) to resist gait rotation',
    cue: 'Emphasize SINGLE-LEG strength (split squat, step-up, single-leg RDL — running is single-leg) + a weekly PLYOMETRIC/reactive slot (pogos, bounds, calf/ankle stiffness → economy, Beattie/Blagrove); low total volume near hard runs.' },
  swimming: { label: 'swimmer', priority: ['vpull', 'hpull'],
    core: 'rotational + anti-rotation + streamline stiffness (hollow hold, Pallof, ab-rollout)',
    cue: 'UPPER PULL-dominant (pull-ups, lat pulldown, rows) + SHOULDER-HEALTH prehab (external rotation, scap/rotator-cuff, YTWs — swimmers’ shoulders are injury-prone); legs lighter unless sprint; balance the over-developed internal rotators with pull + external rotation.' },
  triathlon: { label: 'triathlete', priority: ['squat', 'hinge', 'vpull'],
    core: 'anti-rotation + rotational (covers bike position, run gait, swim body-line)',
    cue: 'Blend cyclist + runner + swimmer needs at LOW total volume (3 sports share recovery): heavy legs, some single-leg, upper pull + shoulder health; injury-prevention first.' },
}
/** Resolve the sport emphasis from the main sport (or the first endurance sport). gym-first/strength → null (balanced). */
export function sportEmphasis({ mainSport, sports = [] } = {}) {
  const cand = String(mainSport || '').toLowerCase() || String((sports || []).map((s) => String(s).toLowerCase()).find((s) => /cycl|ride|bike|\brun|jog|swim|\btri/.test(s)) || '')
  if (/cycl|ride|bike/.test(cand)) return SPORT_EMPHASIS.cycling
  if (/\btri/.test(cand)) return SPORT_EMPHASIS.triathlon
  if (/\brun|jog/.test(cand)) return SPORT_EMPHASIS.running
  if (/swim/.test(cand)) return SPORT_EMPHASIS.swimming
  return null // gym/strength-first or unknown → no sport bias, full-balance as-is
}

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
export function assignWeeklyGym({ sessionsPerWeek = 1, focus = 'support', recentExercises = [], mainSport, sports = [] } = {}) {
  const spw = Math.max(1, Math.min(7, Math.round(Number(sessionsPerWeek) || 1)))
  const f = normFocus(focus)
  const hyper = f === 'muscle' || f === 'support_build' // needs each muscle ~2×/wk → a split; endurance-support → full-body
  const { name: splitName, days } = pickSplit(spw, hyper)
  const recent = new Set((recentExercises || []).map((e) => String(e || '').toLowerCase().trim()))
  const rotations = {}
  for (const pat of GYM_PATTERNS) { const menu = PATTERNS[pat]; rotations[pat] = menu.find((m) => !recent.has(m.toLowerCase())) || menu[0] }
  return { spw, splitName, days, rotations, mustCover: GYM_PATTERNS.slice(), arms: true, focus: f, repScheme: REP_SCHEME[f], emphasis: sportEmphasis({ mainSport, sports }) }
}

// render the assignment for the prompt block: the split + each session's patterns (with a fresh accessory each).
export function gymBalanceLines(assign) {
  const perSession = assign.days.map((pats, i) => `Session ${i + 1}: ${pats.map((p) => `${LABEL[p] || p} (e.g. ${assign.rotations[p]})`).join(' · ')}`).join('\n')
  const rs = assign.repScheme
  const repLine = rs
    ? `\nREP SCHEME (focus = ${assign.focus}) — PRIMARY compound lifts: ${rs.mains} reps at ~${rs.pctLow}-${rs.pctHigh}% of 1-rep-max, tempo ${rs.tempo}. ${rs.intent} ACCESSORIES / arms: ${rs.accessories} reps. Prescribe the MAINS to this rep row; do NOT default everything to 8-12.`
    : ''
  const em = assign.emphasis
  const emphLine = em
    ? `\nSPORT EMPHASIS (${em.label}) — still cover every pattern, but PRIORITIZE ${em.priority.map((p) => LABEL[p] || p).join(' + ')} and pick accessories toward: ${em.cue} CORE style: ${em.core}.`
    : ''
  return `Split = ${assign.splitName} (${assign.spw} gym session${assign.spw !== 1 ? 's' : ''}/week).\n${perSession}${repLine}${emphLine}`
}
