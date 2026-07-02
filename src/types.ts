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
  /** work duration in seconds (for the guided timed player) */
  seconds?: number
  /** rest in seconds after this exercise */
  rest?: number
  /** optional cue or coaching note */
  note?: string
  /** demonstration still image */
  image?: string
  /** demonstration video (direct .mp4) */
  video?: string
  /** fallback external demo link when no image/video is available */
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
  /** Optional direct video URL. Usually blank — demos link out to MuscleWiki. */
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
  /** ingredient-inferred dietary class (build-catalog) — gates coach + in-app meal browse (#40) */
  diet?: 'omnivore' | 'vegetarian' | 'vegan'
  servings?: number
  /** original recipe source URL (e.g. TheMealDB / blog) */
  source?: string
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
  audioUrl?: string // direct audio URL (the meditation .mp3)
}

/** A single day in the rotating weekly meal plan. */
export interface MealPlanDay {
  day: number // 1..7
  breakfast: string // recipe id
  lunch: string
  dinner: string
  snack: string
}

// --- Endurance (JOIN: cycling + running) ----------------------------------
// Structured interval workouts. Cycling targets power as a % of FTP
// (rawPower); running targets pace/threshold similarly. The player scales the
// % target to the athlete's own FTP/threshold, plus a human-readable range.
export type EnduranceSport = 'cycling' | 'running'

export interface EnduranceInterval {
  /** seconds */
  duration: number
  /** target as % of threshold (FTP for cycling), e.g. 65 */
  rawPower: number
  /** display range from source, e.g. "162-189" W (cycling) or pace (running) */
  power?: string
  /** display heart-rate range, e.g. "117-134" */
  heartRate?: string
}

export interface EnduranceBlock {
  /** how many times the intervals in this block repeat */
  numRepeats: number
  intervals: EnduranceInterval[]
}

/** A single exercise in the library (the gym building block). */
export interface LibExercise {
  id: string
  name: string
  image?: string
  video?: string
  /** Female demo variant (MuscleWiki provides both). */
  imageFemale?: string
  videoFemale?: string
  seconds?: number
  category: string // Legs | Push | Pull | Core | Cardio | Mobility | Full body
  muscle?: string // primary muscle (MuscleWiki)
  equipment?: string // Barbell | Dumbbells | Bodyweight | … (MuscleWiki)
  difficulty?: string
  instructions?: string[] // step-by-step (free-exercise-db)
  source?: 'centr' | 'musclewiki' | 'free-exercise-db'
  /** #298 derived: uses a resistance band (equipment 'Bands' OR band in the name, incl. band-assisted
   *  barbell/dumbbell moves) — powers the "Bands" filter. Set in catalog.ts, not the generated JSON. */
  band?: boolean
}

export interface EnduranceWorkout {
  id: string
  name: string
  sport: EnduranceSport
  category: string // Vo2max | Threshold | Strength | Endurance | Performance tests
  /** minutes */
  duration: number
  intensity?: number
  stress?: number
  description?: string
  thumbnail?: string
  blocks: EnduranceBlock[]
}
