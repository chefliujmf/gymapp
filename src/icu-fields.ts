// Shared feedback field definitions (pure data — no React) so both the UI (PostWorkout /
// ActivityFeedback) and the intervals reader/writer use ONE source of truth.
// intervals.icu "Feel" scale + custom ACTIVITY_FIELDs (fetched 2026-06-26 from /athlete/{id}/custom-item).
// IMPORTANT: on an intervals ACTIVITY the custom fields + feel are stored as 1-BASED NUMBER indices
// into these option lists (verified 2026-07-01: FuelGI=1 → 'not needed', feel=3 → 'Normal').
export const FEEL: [string, string][] = [['Strong', '😎'], ['Good', '🙂'], ['Normal', '😐'], ['Poor', '🙁'], ['Weak', '😵']]
export const FEEL_LABELS = FEEL.map(([l]) => l) // index 0 = feel value 1
export const RPE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export const ICU_FIELDS: [string, string[]][] = [
  ['Legs Before', ['fresh', 'normal', 'relaxed', 'heavy', 'sore', 'flat', 'tired']],
  ['Legs After', ['strong', 'normal', 'tired OK', 'barely tired', 'heavy', 'sore', 'cooked']],
  ['Fuel/GI', ['not needed', 'water only OK', 'carbs OK', 'underfueled', 'GI issue', 'too much fuel']],
  ['Pain/Niggles', ['none', 'knee', 'back', 'neck/shoulder', 'foot', 'saddle', 'other']],
]
// intervals field CODE (the activity property name) for each label.
export const ICU_FIELD_CODES: Record<string, string> = { 'Legs Before': 'LegsBefore', 'Legs After': 'LegsAfter', 'Fuel/GI': 'FuelGI', 'Pain/Niggles': 'PainNiggles', 'Life Constraint': 'LifeConstraint', 'Mental State': 'MentalState' }

// #330 — RUNS get running-appropriate options (a run must NOT show "saddle" etc.). Same LABELS + codes as
// ICU_FIELDS so the intervals round-trip still works (index-based); only the sport-specific choices differ.
// Read-back is sport-aware (readIcuFeedback), so the form and the stored value stay consistent.
export const RUN_FIELDS: [string, string[]][] = [
  ['Legs Before', ['fresh', 'normal', 'relaxed', 'heavy', 'sore', 'flat', 'tired']],
  ['Legs After', ['strong', 'normal', 'tired OK', 'barely tired', 'heavy', 'sore', 'cooked']],
  ['Fuel/GI', ['not needed', 'water only OK', 'gels/carbs OK', 'underfueled', 'GI issue', 'too much fuel']],
  ['Pain/Niggles', ['none', 'knee', 'shin/calf', 'foot/ankle', 'hip', 'IT band', 'hamstring', 'other']],
]

// GYM is its OWN set (#152) — no Legs/Fuel. These are Platyplus-only (intervals has no gym custom fields).
export const GYM_FIELDS: [string, string[]][] = [
  ['Soreness/pump', ['none', 'light', 'good pump', 'sore', 'very sore']],
  ['Form', ['clean', 'mostly clean', 'broke down']],
  ['Pain/Niggles', ['none', 'shoulder', 'low back', 'knee', 'wrist', 'elbow', 'other']],
]
export const FIELDS: Record<string, [string, string[]][]> = { ride: ICU_FIELDS, run: RUN_FIELDS, gym: GYM_FIELDS }

/** options list for an ICU field label */
export const optsFor = (label: string) => (ICU_FIELDS.find(([l]) => l === label)?.[1]) || []
