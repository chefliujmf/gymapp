// #265 — fuelling math. Pure + unit-tested (src/nutrition.test.ts). Inputs come from the
// profile, ideally two-way-synced from intervals (#268): sex, weight, height, age.
//
// BMR  : Mifflin-St Jeor (the current clinical standard; more accurate than Harris-Benedict).
// TDEE : resting + everyday non-exercise (a light baseline factor) PLUS the day's actual
//        training calories from intervals when we have them — far truer than a fixed
//        "activity multiplier" for an athlete whose training swings day to day.
// Macros: protein by goal (g/kg), a fat floor for hormones, the rest as carbs; fiber + water.

export type Sex = 'male' | 'female'
export type Goal = 'lose' | 'maintain' | 'gain'

export interface BodyInputs { sex: Sex; weightKg: number; heightCm: number; age: number }

/** Mifflin-St Jeor basal metabolic rate (kcal/day). Returns null if any input is missing/invalid. */
export function bmr(b: Partial<BodyInputs>): number | null {
  const { sex, weightKg, heightCm, age } = b
  if (!sex || !weightKg || !heightCm || !age || weightKg <= 0 || heightCm <= 0 || age <= 0) return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(base + (sex === 'male' ? 5 : -161))
}

// Light baseline factor over BMR for non-exercise daily life (NEAT + thermic effect of food),
// BEFORE training is added. ~1.15 ≈ a desk-ish day; training kcal is added on top.
const BASELINE_FACTOR = 1.15
// Fallback whole-day multipliers when we have NO per-day training calories.
const ACTIVITY_FACTORS: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 }

/** Total daily energy expenditure. Prefer baseline + the day's actual training kcal (from
 *  intervals); fall back to a whole-day activity multiplier when training kcal is unknown. */
export function tdee(bmrVal: number | null, opts: { activeKcal?: number | null; activity?: keyof typeof ACTIVITY_FACTORS } = {}): number | null {
  if (bmrVal == null) return null
  if (opts.activeKcal != null && opts.activeKcal >= 0) return Math.round(bmrVal * BASELINE_FACTOR + opts.activeKcal)
  const f = ACTIVITY_FACTORS[opts.activity || 'moderate'] || ACTIVITY_FACTORS.moderate
  return Math.round(bmrVal * f)
}

/** Calorie target for the goal: a moderate deficit/surplus around maintenance (TDEE). */
export function calorieTarget(tdeeVal: number | null, goal: Goal = 'maintain'): number | null {
  if (tdeeVal == null) return null
  const delta = goal === 'lose' ? -0.18 : goal === 'gain' ? 0.1 : 0 // ~−18% cut, +10% lean gain
  return Math.round(tdeeVal * (1 + delta))
}

const PROTEIN_GKG: Record<Goal, number> = { lose: 2.2, maintain: 1.8, gain: 2.0 } // higher on a cut to spare muscle

/** Daily protein target (g) by goal — per kg bodyweight. */
export function proteinTarget(weightKg: number | null | undefined, goal: Goal = 'maintain'): number | null {
  if (!weightKg || weightKg <= 0) return null
  return Math.round(weightKg * PROTEIN_GKG[goal])
}

export interface Macros { protein: number; fat: number; carbs: number }
/** Split a calorie target into grams: protein by goal, a fat floor (~0.9 g/kg) for hormones,
 *  the remainder as carbs (the athlete's main fuel). 4/4/9 kcal per g. */
export function macroSplit(kcal: number | null, weightKg: number | null | undefined, goal: Goal = 'maintain'): Macros | null {
  if (kcal == null || !weightKg || weightKg <= 0) return null
  const protein = proteinTarget(weightKg, goal)!
  const fat = Math.round(weightKg * 0.9)
  const carbKcal = Math.max(0, kcal - protein * 4 - fat * 9)
  return { protein, fat, carbs: Math.round(carbKcal / 4) }
}

/** Recommended fiber (g) ≈ 14 g per 1000 kcal (Dietary Guidelines). */
export const fiberTarget = (kcal: number | null): number | null => (kcal == null ? null : Math.round((kcal / 1000) * 14))
/** Baseline water (L) ≈ 0.033 L/kg; add training losses separately. */
export const waterTarget = (weightKg: number | null | undefined): number | null => (!weightKg || weightKg <= 0 ? null : Math.round(weightKg * 0.033 * 10) / 10)

/** Whole-number age from an ISO date of birth, relative to a reference ISO date (today). */
export function ageFromDob(dobISO?: string | null, todayISO?: string): number | null {
  if (!dobISO) return null
  const dob = new Date(dobISO + (dobISO.length <= 10 ? 'T00:00:00Z' : ''))
  const ref = todayISO ? new Date(todayISO + 'T00:00:00Z') : new Date()
  if (isNaN(dob.getTime())) return null
  let age = ref.getUTCFullYear() - dob.getUTCFullYear()
  const m = ref.getUTCMonth() - dob.getUTCMonth()
  if (m < 0 || (m === 0 && ref.getUTCDate() < dob.getUTCDate())) age--
  return age > 0 && age < 130 ? age : null
}
