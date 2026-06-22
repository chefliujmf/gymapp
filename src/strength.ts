// Strength engine: estimated 1-rep max + the inverse (suggest a weight for a target
// rep count) + history helpers. This is the loop that lets the coach prescribe reps
// and the app fill the weight.
import type { WorkoutLog } from './db'

/** Estimated 1-rep max — average of Epley & Brzycki (most accurate at 2–10 reps). */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps) return 0
  if (reps <= 1) return weight
  const epley = weight * (1 + reps / 30)
  const brzycki = reps < 37 ? (weight * 36) / (37 - reps) : epley
  return (epley + brzycki) / 2
}

/** Inverse: the weight that should let you hit `reps` given an estimated 1RM. */
export function weightForReps(oneRM: number, reps: number): number {
  if (!oneRM) return 0
  if (reps <= 1) return oneRM
  const wEpley = oneRM / (1 + reps / 30)
  const wBrzycki = reps < 37 ? (oneRM * (37 - reps)) / 36 : wEpley
  return (wEpley + wBrzycki) / 2
}

/** Round a load to a usable increment (2.5 kg default). */
export const roundLoad = (w: number, step = 2.5) => (w > 0 ? Math.round(w / step) * step : 0)

/** Best e1RM per exercise name from recent logs (the working number to prescribe against). */
export function bestE1rmByExercise(logs: WorkoutLog[], sinceDays = 120): Map<string, { e1rm: number; date: string }> {
  const cut = new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10)
  const m = new Map<string, { e1rm: number; date: string }>()
  for (const log of logs) {
    if (!log.sets || !log.exNames || log.date < cut) continue
    for (const [idx, setArr] of Object.entries(log.sets)) {
      const name = log.exNames[Number(idx)]
      if (!name || !Array.isArray(setArr)) continue
      let best = 0
      for (const s of setArr) if (s.weight && s.reps) best = Math.max(best, e1rm(s.weight, s.reps))
      if (best > 0) { const cur = m.get(name); if (!cur || best > cur.e1rm) m.set(name, { e1rm: best, date: log.date }) }
    }
  }
  return m
}

/** The most recent logged sets for an exercise — the grey "last time" reference. */
export function lastSessionSets(logs: WorkoutLog[], name: string): { weight?: number; reps?: number }[] | null {
  for (const log of [...logs].sort((a, b) => b.date.localeCompare(a.date))) {
    if (!log.sets || !log.exNames) continue
    const idx = log.exNames.indexOf(name)
    if (idx >= 0 && log.sets[idx]?.length) return log.sets[idx]
  }
  return null
}
