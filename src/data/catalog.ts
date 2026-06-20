import type {
  Workout, Program, Recipe, Trainer, MindSession, MealPlanDay, EnduranceWorkout, LibExercise,
} from '../types'

// Real catalog, generated from the user's own collected content by
// scripts/build-catalog.mjs (run `npm run build:catalog`). Source data is
// gitignored; the generated JSON below is the app's read-only content.
import workoutsData from './generated/workouts.json'
import recipesData from './generated/recipes.json'
import mindData from './generated/mind.json'
import enduranceData from './generated/endurance.json'
import exercisesData from './generated/exercises.json'

export const workouts = workoutsData as unknown as Workout[]
/** The exercise library — the gym building blocks. */
export const exercises = exercisesData as unknown as LibExercise[]
export const exerciseCategories = ['Legs', 'Push', 'Pull', 'Core', 'Cardio', 'Mobility', 'Full body', 'Yoga', 'Pilates'] as const
/** Equipment types present in the library (mostly from MuscleWiki). */
export const exerciseEquipment = [...new Set(exercises.map((e) => e.equipment).filter(Boolean) as string[])].sort()
/** Muscle groups present in the library, ordered by how many exercises hit them. */
export const exerciseMuscles = (() => {
  const count = new Map<string, number>()
  for (const e of exercises) if (e.muscle) count.set(e.muscle, (count.get(e.muscle) || 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m)
})()
export const recipes = recipesData as unknown as Recipe[]
export const mindSessions = mindData as unknown as MindSession[]
/** JOIN cycling + running interval workouts. */
export const endurance = enduranceData as unknown as EnduranceWorkout[]

export const trainers: Trainer[] = [
  { id: 't-alex', name: 'Alex Rivera', specialty: 'Strength & Hypertrophy', bio: 'Builds size and strength with progressive overload and clean technique.', disciplines: ['strength'] },
  { id: 't-mia', name: 'Mia Chen', specialty: 'Mobility & Foundations', bio: 'Smart full-body training and mobility to keep you building injury-free.', disciplines: ['strength', 'mobility', 'yoga'] },
  { id: 't-dev', name: 'Dev Okafor', specialty: 'Arms & Conditioning', bio: 'High-volume pump work and conditioning to round out your physique.', disciplines: ['strength', 'hiit'] },
]

// A starter program auto-assembled from real workouts so the Today/Program
// pages work. Real multi-week programs are built in a later phase.
function starterProgram(): Program[] {
  if (workouts.length < 5) return []
  const w = workouts
  return [{
    id: 'starter',
    title: 'Starter Week',
    discipline: 'strength',
    weeks: 4,
    daysPerWeek: 5,
    level: 'intermediate',
    summary: 'A balanced week of sessions to get you moving — train 5, rest 2.',
    schedule: [
      { day: 1, label: w[0].title, workoutId: w[0].id },
      { day: 2, label: w[1].title, workoutId: w[1].id },
      { day: 3, label: 'Rest', workoutId: null },
      { day: 4, label: w[2].title, workoutId: w[2].id },
      { day: 5, label: w[3].title, workoutId: w[3].id },
      { day: 6, label: w[4].title, workoutId: w[4].id },
      { day: 7, label: 'Rest', workoutId: null },
    ],
  }]
}
export const programs: Program[] = starterProgram()

// Rotating 7-day meal plan assembled from the real recipe library.
function pick(category: Recipe['category'], n: number): string {
  const list = recipes.filter((r) => r.category === category)
  const src = list.length ? list : recipes
  return src.length ? src[n % src.length].id : ''
}
export const mealPlan: MealPlanDay[] = Array.from({ length: 7 }, (_, i) => ({
  day: i + 1,
  breakfast: pick('breakfast', i),
  lunch: pick('lunch', i),
  dinner: pick('dinner', i),
  snack: pick('snack', i),
}))

export const allWorkoutsById = Object.fromEntries(workouts.map((w) => [w.id, w]))
export const allProgramsById = Object.fromEntries(programs.map((p) => [p.id, p]))
export const allRecipesById = Object.fromEntries(recipes.map((r) => [r.id, r]))
export const allTrainersById = Object.fromEntries(trainers.map((t) => [t.id, t]))
export const allMindById = Object.fromEntries(mindSessions.map((m) => [m.id, m]))
export const allEnduranceById = Object.fromEntries(endurance.map((e) => [e.id, e]))
export const allExercisesById = Object.fromEntries(exercises.map((e) => [e.id, e]))
