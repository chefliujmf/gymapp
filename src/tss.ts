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

/** Infer intensity from an "RPE n" note in the coach's description. */
export function rpeIntensity(text = ''): GymIntensity {
  const m = text.match(/RPE\s*(\d+)/i)
  if (!m) return 'moderate'
  const rpe = Number(m[1])
  return rpe <= 4 ? 'low' : rpe >= 8 ? 'high' : 'moderate'
}
