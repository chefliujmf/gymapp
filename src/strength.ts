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

// #255 — per-lift coach insight from the dated e1RM history: are you progressing, at a PR, or stalled,
// + a concrete next step. Pure + unit-tested. `fmt` renders a kg value in the user's display unit.
export type LiftTone = 'pr' | 'up' | 'stall' | 'flat' | 'new'
export function exerciseInsight(pts: { date: number; e1rm: number }[], fmt: (kg: number) => string = (v) => `${Math.round(v)} kg`): { tone: LiftTone; text: string } | null {
  const p = pts.filter((x) => x.e1rm > 0).sort((a, b) => a.date - b.date)
  if (!p.length) return null
  const vals = p.map((x) => x.e1rm)
  const last = vals[vals.length - 1]
  if (p.length === 1) return { tone: 'new', text: `First logged session at ${fmt(last)} est 1RM — log a few more and I'll track your progression and suggest jumps.` }
  const peak = Math.max(...vals)
  const peakIdx = vals.lastIndexOf(peak)
  const first = vals[0]
  const deltaAll = last - first
  const prev = vals[vals.length - 2] // immediately-previous session
  const sessionsSincePeak = vals.length - 1 - peakIdx
  const weeksSincePeak = Math.round((p[p.length - 1].date - p[peakIdx].date) / (7 * 864e5))
  if (last >= peak - 0.01) return { tone: 'pr', text: `📈 On form — est 1RM ${fmt(last)}${deltaAll > 0.5 ? `, +${fmt(deltaAll)} since you started` : ''}. Nudge the top set up while it moves clean.` }
  if (sessionsSincePeak >= 3) return { tone: 'stall', text: `⚠️ Stalled — ${weeksSincePeak >= 1 ? `~${weeksSincePeak} wk` : `${sessionsSincePeak} sessions`} off your ${fmt(peak)} peak. Change the stimulus: vary the rep range, or take a lighter deload week then rebuild.` }
  if (last > prev + 0.01) return { tone: 'up', text: `Trending up — ${fmt(last)}, back toward your ${fmt(peak)} peak. Keep the progression going.` }
  return { tone: 'flat', text: `Holding ~${fmt(last)} (peak ${fmt(peak)}). Push the top set for a rep more, or add a set, to break through.` }
}

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
