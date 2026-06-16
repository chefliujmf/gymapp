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

const db = new Dexie('gymapp') as Dexie & {
  logs: EntityTable<WorkoutLog, 'id'>
  enrollments: EntityTable<ProgramEnrollment, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  logs: '++id, workoutId, date, completedAt',
  enrollments: '++id, programId',
  settings: 'key',
})

export { db }

// --- convenience helpers ---------------------------------------------------

export async function logWorkout(entry: Omit<WorkoutLog, 'id' | 'completedAt'>) {
  return db.logs.add({ ...entry, completedAt: Date.now() })
}

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value
}

export async function setSetting(key: string, value: string) {
  return db.settings.put({ key, value })
}

export async function enrollInProgram(programId: string) {
  const existing = await db.enrollments.where('programId').equals(programId).first()
  if (existing) return existing.id
  return db.enrollments.add({ programId, startedAt: Date.now(), currentDayIndex: 0 })
}
