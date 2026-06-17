import type { Program } from './types'
import type { WorkoutLog } from './db'

/**
 * Program completion, (e.g. 3/84). Total = every non-rest session
 * across the whole program (weeks × training days). Completed = logged
 * workouts whose id is part of this program, capped at the total.
 */
export function programProgress(program: Program, logs: WorkoutLog[] | undefined) {
  const trainingDays = program.schedule.filter((d) => d.workoutId)
  const total = trainingDays.length * program.weeks
  const ids = new Set(trainingDays.map((d) => d.workoutId))
  const completed = Math.min(total, (logs ?? []).filter((l) => ids.has(l.workoutId)).length)
  const pct = total ? completed / total : 0
  return { completed, total, pct }
}
