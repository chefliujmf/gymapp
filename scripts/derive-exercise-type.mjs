// #664 — stamp a machine-readable TYPE on every catalog exercise so the coach / player / gym-guard DERIVE
// mode(timed vs reps), eachSide(unilateral), and loaded(weight-trackable) instead of the LLM guessing per exercise
// (the root cause of plank-as-3×10 #642, missing "each side", and the loaded-move BW-lock #639). Pure + unit-tested.

// Categories that are inherently TIMED (held/flowed for time, not counted in reps).
const TIMED_CAT = /mobility|yoga|pilates|stretch|recovery/i
// Names that are timed holds/carries/dynamic-warmups regardless of category. (NB "leg swing" is timed but a
// "kettlebell swing" is a REP move — so match "leg swing", never bare "swing".)
const TIMED_NAME = /\bplank\b|\bhold\b|isometric|dead ?hang|\bhang\b|wall ?sit|\bcarry\b|farmer|suitcase carry|\bstretch\b|\bpose\b|bird ?dog|dead ?bug|hollow|superman|bridge hold|\bl-?sit\b|flutter|breathing|savasana|\bbalance\b|\bhover\b|leg ?swings?|arm ?circles?|shoulder ?circles?|hip ?circles?|ankle ?circles?|high ?knees?|butt ?kicks?|inchworm|world.?s? greatest|scorpion|spider.?man|cat.?cow|thread the needle|90[- ]?90|open.?book|monster ?walk|band ?pull.?apart/i
// Names that clearly work ONE side at a time (the dose is per side).
const EACHSIDE_NAME = /\b(single|one)[- ]?(arm|leg|side)\b|each side|per side|\((left|right)\)|[ -](left|right)$|\blunge\b|split squat|bulgarian|step[- ]?up|pistol|\bshrimp\b|curtsy|skater|windmill|cossack|turkish|get[- ]?up|side plank|copenhagen|\bpallof\b|suitcase|\barcher\b|staggered|kickstand|b[- ]?stance|leg ?swings?/i
// Names that carry an EXTERNAL LOAD even if the equipment tag says otherwise (the #639 mis-tags).
const LOADED_NAME = /goblet|sandbag|slam ?ball|\bsled\b|prowler|\byoke\b|farmer|weighted|trap ?bar|landmine|kettlebell|dumbbell|barbell|\bplate\b|\bcable\b|\bmachine\b|\bsmith\b|\bband\b/i

/** Default hold seconds for a timed move, by kind. */
function defaultSeconds(n) {
  if (/\bcarry\b|farmer|suitcase/.test(n)) return 40
  if (/\bplank\b|\bhold\b|isometric|hollow|superman|bridge hold|dead ?hang|\bhang\b|wall ?sit|\bl-?sit\b/.test(n)) return 40
  return 30 // mobility / stretch / flow
}

/**
 * Stamp `timed`, `eachSide`, `loaded` (+ a default `seconds` for timed moves) onto an exercise. Mutates + returns it.
 * Conservative: only sets a flag when the signal is clear, so it never mis-labels a plain strength lift.
 */
export function deriveExerciseType(e) {
  if (!e || typeof e !== 'object') return e
  const n = String(e.name || '').toLowerCase()
  const cat = String(e.category || '').toLowerCase()
  const isTimed = TIMED_CAT.test(cat) || TIMED_NAME.test(n)
  if (isTimed) { e.timed = true; if (!e.seconds) e.seconds = defaultSeconds(n) }
  if (EACHSIDE_NAME.test(n)) e.eachSide = true
  const eqLoaded = e.equipment && !/^bodyweight$/i.test(String(e.equipment).trim())
  if (LOADED_NAME.test(n) || eqLoaded) e.loaded = true
  return e
}
