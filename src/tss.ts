// Estimated Training Stress Score for strength sessions — Joe Friel's Time × RPE
// method (joefrieltraining.com/the-weightlifting-pmc-part-2/):
//   low intensity / high reps    ~25 TSS/hour
//   moderate / standard lifting  ~45 TSS/hour
//   high intensity / heavy        ~65 TSS/hour
export type GymIntensity = 'low' | 'moderate' | 'high'

export function gymTSS(durationMin: number, intensity: GymIntensity = 'moderate'): number {
  const perHour = intensity === 'low' ? 25 : intensity === 'high' ? 65 : 45
  return Math.max(1, Math.round((durationMin / 60) * perHour))
}

// POST-session estimate (#81): once the athlete rates the session (RPE 1–10), use the
// ACTUAL effort instead of the planned bucket. Continuous TSS/hour ≈ 8 + RPE×6, which
// tracks Friel's buckets (RPE≈4→~32, ≈6→~44, ≈8→~56, ≈10→~68). Use this when an RPE
// was logged; fall back to gymTSS(duration, intensity) otherwise.
export function gymTSSfromRPE(durationMin: number, rpe: number): number {
  const r = Math.max(1, Math.min(10, rpe))
  const perHour = Math.max(10, Math.min(70, Math.round(8 + r * 6)))
  return Math.max(1, Math.round((durationMin / 60) * perHour))
}

/** Infer intensity from an "RPE n" note in the coach's description. */
export function rpeIntensity(text = ''): GymIntensity {
  const m = text.match(/RPE\s*(\d+)/i)
  if (!m) return 'moderate'
  const rpe = Number(m[1])
  return rpe <= 4 ? 'low' : rpe >= 8 ? 'high' : 'moderate'
}
