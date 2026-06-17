// Core domain model for the personal fitness app.
// Catalog content (workouts/programs/recipes) is read-only seed data.
// User activity (logs, progress) lives in IndexedDB — see db.ts.

export type Discipline =
  | 'strength'
  | 'hiit'
  | 'cardio'
  | 'yoga'
  | 'pilates'
  | 'mobility'
  | 'boxing'
  | 'meditation'

export interface Exercise {
  name: string
  /** e.g. "3 x 10", "40s on / 20s off", "5 min" */
  prescription: string
  /** optional cue or coaching note */
  note?: string
  /** external demonstration link (e.g. MuscleWiki search for this movement) */
  demoUrl?: string
}

export interface Workout {
  id: string
  title: string
  discipline: Discipline
  /** minutes */
  duration: number
  level: 'beginner' | 'intermediate' | 'advanced'
  equipment: string[]
  /** short marketing-style blurb */
  summary: string
  coach?: string
  /** Playback source. Either an Emby stream URL or any direct video URL.
   *  Left blank until you wire content in. */
  videoUrl?: string
  thumbnail?: string
  exercises?: Exercise[]
  /** kcal estimate, optional */
  calories?: number
}

export interface ProgramDay {
  day: number
  label: string
  /** Workout id, or null for a rest day */
  workoutId: string | null
}

export interface Program {
  id: string
  title: string
  discipline: Discipline
  weeks: number
  daysPerWeek: number
  level: 'beginner' | 'intermediate' | 'advanced'
  summary: string
  thumbnail?: string
  schedule: ProgramDay[]
}

export interface Recipe {
  id: string
  title: string
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  minutes: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  ingredients: string[]
  steps: string[]
  thumbnail?: string
  tags: string[]
  diet?: ('vegan' | 'vegetarian' | 'high-protein' | 'low-carb' | 'gluten-free')[]
  servings?: number
}

export interface Trainer {
  id: string
  name: string
  specialty: string
  bio: string
  disciplines: Discipline[]
  avatar?: string
}

export type MindKind = 'meditation' | 'breathwork' | 'sleep' | 'focus'

export interface MindSession {
  id: string
  title: string
  kind: MindKind
  duration: number // minutes
  summary: string
  coach?: string
  audioUrl?: string // point at an Emby/audio stream
}

/** A single day in the rotating weekly meal plan. */
export interface MealPlanDay {
  day: number // 1..7
  breakfast: string // recipe id
  lunch: string
  dinner: string
  snack: string
}
