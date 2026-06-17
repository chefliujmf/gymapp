import Dexie, { type EntityTable } from 'dexie'

// User activity — lives on-device. Catalog content stays in code/seed.

export interface WorkoutLog {
  id?: number
  workoutId: string
  title: string
  discipline: string
  duration: number
  /** ISO date string, e.g. 2026-06-16 */
  date: string
  completedAt: number
  notes?: string
  /** total sets completed and total volume (sum of weight × reps) */
  setsCompleted?: number
  volume?: number
  /** full per-exercise set snapshot, for progressive-overload prefill */
  sets?: Record<number, SetEntry[]>
}

export interface ProgramEnrollment {
  id?: number
  programId: string
  startedAt: number
  /** which schedule day index the user is on (0-based) */
  currentDayIndex: number
}

export interface Setting {
  key: string
  value: string
}

/** One exercise inside a built workout template.
 * mode 'timed'  → countdown for `seconds`, auto-advance (circuits/mobility).
 * mode 'reps'   → `sets` × `reps` (optional `weight`), log weight×reps per set. */
export interface TemplateExercise {
  exId?: string
  name: string
  image?: string
  video?: string
  mode?: 'timed' | 'reps' // default 'timed' (back-compat)
  seconds: number
  rest: number
  sets?: number
  reps?: number
  weight?: number
}

/** A workout the user assembled from the exercise library. */
export interface WorkoutTemplate {
  id?: number
  name: string
  rounds: number
  exercises: TemplateExercise[]
  createdAt: number
}

/** One logged set: weight + reps + whether it's been completed. */
export interface SetEntry {
  weight?: number
  reps?: number
  done: boolean
}

/**
 * The single in-progress workout. Persisted on every change so that locking
 * the phone / backgrounding the PWA / the tab being evicted never loses state —
 * reopening resumes exactly here. Timers store ABSOLUTE epoch ms (restEndsAt),
 * never a running countdown, so they stay correct across a screen-off gap.
 */
export interface ActiveSession {
  key: 'current'
  workoutId: string
  startedAt: number
  /** exercise index (0-based) -> the sets logged for it (weight × reps) */
  sets: Record<number, SetEntry[]>
  /** absolute epoch ms when the current rest ends, or null if not resting */
  restEndsAt: number | null
  updatedAt: number
}

const db = new Dexie('gymapp') as Dexie & {
  logs: EntityTable<WorkoutLog, 'id'>
  enrollments: EntityTable<ProgramEnrollment, 'id'>
  settings: EntityTable<Setting, 'key'>
  activeSession: EntityTable<ActiveSession, 'key'>
  templates: EntityTable<WorkoutTemplate, 'id'>
}

db.version(2).stores({
  logs: '++id, workoutId, date, completedAt',
  enrollments: '++id, programId',
  settings: 'key',
  activeSession: 'key',
})
// v3 changed the ActiveSession shape (per-set weight/reps). Drop any in-flight
// session from the old shape rather than migrate a half-finished workout.
db.version(3)
  .stores({
    logs: '++id, workoutId, date, completedAt',
    enrollments: '++id, programId',
    settings: 'key',
    activeSession: 'key',
  })
  .upgrade((tx) => tx.table('activeSession').clear())
// v4: workout templates assembled from the exercise library.
db.version(4).stores({
  logs: '++id, workoutId, date, completedAt',
  enrollments: '++id, programId',
  settings: 'key',
  activeSession: 'key',
  templates: '++id, createdAt',
})

export { db }

// --- workout templates -----------------------------------------------------

export async function saveTemplate(t: Omit<WorkoutTemplate, 'id' | 'createdAt'> & { id?: number }) {
  if (t.id != null) {
    await db.templates.update(t.id, { name: t.name, rounds: t.rounds, exercises: t.exercises })
    return t.id
  }
  return db.templates.add({ name: t.name, rounds: t.rounds, exercises: t.exercises, createdAt: Date.now() })
}
export async function listTemplates() {
  return db.templates.orderBy('createdAt').reverse().toArray()
}
export async function getTemplate(id: number) {
  return db.templates.get(id)
}
export async function deleteTemplate(id: number) {
  return db.templates.delete(id)
}

// --- convenience helpers ---------------------------------------------------

export async function logWorkout(entry: Omit<WorkoutLog, 'id' | 'completedAt'>) {
  return db.logs.add({ ...entry, completedAt: Date.now() })
}

/** Most recent completed log for a workout — used to prefill last weights/reps. */
export async function lastLogForWorkout(workoutId: string): Promise<WorkoutLog | undefined> {
  const logs = await db.logs.where('workoutId').equals(workoutId).toArray()
  return logs.sort((a, b) => b.completedAt - a.completedAt)[0]
}

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value
}

export async function setSetting(key: string, value: string) {
  return db.settings.put({ key, value })
}

// --- active session (resume-after-lock) ----------------------------------

export async function getActiveSession() {
  return db.activeSession.get('current')
}

export async function startSession(workoutId: string, sets: Record<number, SetEntry[]>) {
  const session: ActiveSession = {
    key: 'current',
    workoutId,
    startedAt: Date.now(),
    sets,
    restEndsAt: null,
    updatedAt: Date.now(),
  }
  await db.activeSession.put(session)
  return session
}

export async function saveSession(patch: Partial<ActiveSession>) {
  const cur = await getActiveSession()
  if (!cur) return
  await db.activeSession.put({ ...cur, ...patch, updatedAt: Date.now() })
}

export async function clearSession() {
  await db.activeSession.delete('current')
}

export async function enrollInProgram(programId: string) {
  const existing = await db.enrollments.where('programId').equals(programId).first()
  if (existing) return existing.id
  return db.enrollments.add({ programId, startedAt: Date.now(), currentDayIndex: 0 })
}
