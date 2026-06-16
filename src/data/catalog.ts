import type { Workout, Program, Recipe } from '../types'

// ---------------------------------------------------------------------------
// Seed catalog. This is starter content so the app is usable on day one.
// Replace / extend by running the Centr collector (scripts/seed-from-centr.mjs),
// which writes src/data/centr/*.json from YOUR Centr account, or by editing here.
// videoUrl is intentionally blank — point it at your Emby stream URLs.
// ---------------------------------------------------------------------------

export const workouts: Workout[] = [
  {
    id: 'w-full-body-strength',
    title: 'Full Body Strength',
    discipline: 'strength',
    duration: 45,
    level: 'intermediate',
    equipment: ['dumbbells', 'bench'],
    summary: 'A balanced push/pull/legs circuit hitting every major movement pattern.',
    coach: 'Self-guided',
    calories: 320,
    exercises: [
      { name: 'Goblet Squat', prescription: '4 x 10', note: 'Chest up, drive through midfoot.' },
      { name: 'Romanian Deadlift', prescription: '4 x 10', note: 'Soft knees, hinge at the hips.' },
      { name: 'Chest-Supported Row', prescription: '4 x 12' },
      { name: 'DB Bench Press', prescription: '4 x 10' },
      { name: 'Walking Lunge', prescription: '3 x 12 / leg' },
      { name: 'Pallof Press', prescription: '3 x 12 / side', note: 'Resist rotation.' },
    ],
  },
  {
    id: 'w-hiit-burner',
    title: '20-Minute HIIT Burner',
    discipline: 'hiit',
    duration: 20,
    level: 'intermediate',
    equipment: [],
    summary: 'Bodyweight intervals — 40s work, 20s rest. Five rounds, no excuses.',
    calories: 240,
    exercises: [
      { name: 'Burpees', prescription: '40s on / 20s off' },
      { name: 'Mountain Climbers', prescription: '40s on / 20s off' },
      { name: 'Jump Squats', prescription: '40s on / 20s off' },
      { name: 'High Knees', prescription: '40s on / 20s off' },
      { name: 'Plank Shoulder Taps', prescription: '40s on / 20s off' },
    ],
  },
  {
    id: 'w-powerflow-mobility',
    title: 'PowerFlow Mobility',
    discipline: 'mobility',
    duration: 30,
    level: 'beginner',
    equipment: ['mat'],
    summary: 'Move-to-release flow for hips, t-spine and hamstrings. Great recovery day work.',
    calories: 110,
    exercises: [
      { name: 'World’s Greatest Stretch', prescription: '5 / side' },
      { name: 'Cat–Cow', prescription: '8 reps' },
      { name: '90/90 Hip Switch', prescription: '8 / side' },
      { name: 'Thread the Needle', prescription: '6 / side' },
      { name: 'Deep Squat Hold', prescription: '60s' },
    ],
  },
  {
    id: 'w-core-15',
    title: 'Core in 15',
    discipline: 'strength',
    duration: 15,
    level: 'beginner',
    equipment: ['mat'],
    summary: 'Short, dense trunk session you can stack onto any ride or workout.',
    calories: 90,
    exercises: [
      { name: 'Dead Bug', prescription: '3 x 10 / side' },
      { name: 'Side Plank', prescription: '3 x 30s / side' },
      { name: 'Hollow Hold', prescription: '3 x 30s' },
      { name: 'Bird Dog', prescription: '3 x 10 / side' },
    ],
  },
  {
    id: 'w-yoga-reset',
    title: 'Evening Yoga Reset',
    discipline: 'yoga',
    duration: 25,
    level: 'beginner',
    equipment: ['mat'],
    summary: 'Slow, restorative flow to down-regulate before sleep.',
    calories: 80,
  },
  {
    id: 'w-conditioning-bike',
    title: 'Bike Conditioning Intervals',
    discipline: 'cardio',
    duration: 40,
    level: 'advanced',
    equipment: ['bike'],
    summary: '4 x 4 min at threshold with 4 min recovery. Pairs with your Intervals.icu plan.',
    calories: 420,
  },
]

export const programs: Program[] = [
  {
    id: 'p-foundations-4wk',
    title: 'Foundations — 4 Weeks',
    discipline: 'strength',
    weeks: 4,
    daysPerWeek: 4,
    level: 'beginner',
    summary: 'Build the base: strength, conditioning and mobility in a sustainable weekly rhythm.',
    schedule: [
      { day: 1, label: 'Strength', workoutId: 'w-full-body-strength' },
      { day: 2, label: 'Mobility', workoutId: 'w-powerflow-mobility' },
      { day: 3, label: 'Conditioning', workoutId: 'w-hiit-burner' },
      { day: 4, label: 'Rest', workoutId: null },
      { day: 5, label: 'Strength + Core', workoutId: 'w-full-body-strength' },
      { day: 6, label: 'Recovery Yoga', workoutId: 'w-yoga-reset' },
      { day: 7, label: 'Rest', workoutId: null },
    ],
  },
]

export const recipes: Recipe[] = [
  {
    id: 'r-protein-oats',
    title: 'Protein Overnight Oats',
    category: 'breakfast',
    minutes: 5,
    kcal: 420,
    protein: 32,
    carbs: 48,
    fat: 11,
    ingredients: [
      '60g rolled oats',
      '1 scoop vanilla protein',
      '200ml milk of choice',
      '1 tbsp chia seeds',
      '1/2 banana, sliced',
      'Handful of berries',
    ],
    steps: [
      'Combine oats, protein, chia and milk in a jar.',
      'Stir well, top with banana and berries.',
      'Refrigerate overnight. Eat cold.',
    ],
    tags: ['high-protein', 'meal-prep', 'vegetarian'],
  },
  {
    id: 'r-chicken-rice-bowl',
    title: 'Chicken & Rice Power Bowl',
    category: 'lunch',
    minutes: 25,
    kcal: 560,
    protein: 45,
    carbs: 62,
    fat: 14,
    ingredients: [
      '180g chicken breast',
      '1 cup cooked brown rice',
      '1 cup roasted veg',
      'Avocado, 1/4',
      'Olive oil, lemon, paprika',
    ],
    steps: [
      'Season and pan-sear chicken until cooked through.',
      'Warm rice and roasted veg.',
      'Slice chicken, assemble bowl, finish with avocado and lemon.',
    ],
    tags: ['high-protein', 'post-workout'],
  },
  {
    id: 'r-salmon-greens',
    title: 'Baked Salmon & Greens',
    category: 'dinner',
    minutes: 30,
    kcal: 510,
    protein: 40,
    carbs: 22,
    fat: 28,
    ingredients: [
      '1 salmon fillet',
      'Broccoli & asparagus',
      'Sweet potato, 1 small',
      'Garlic, olive oil, dill',
    ],
    steps: [
      'Roast sweet potato 25 min at 200°C.',
      'Add salmon and greens for the last 12–15 min.',
      'Finish with dill and a squeeze of lemon.',
    ],
    tags: ['omega-3', 'low-carb'],
  },
  {
    id: 'r-recovery-smoothie',
    title: 'Recovery Smoothie',
    category: 'snack',
    minutes: 3,
    kcal: 280,
    protein: 28,
    carbs: 30,
    fat: 6,
    ingredients: [
      '1 scoop protein',
      '1 banana',
      '200ml milk',
      '1 tbsp peanut butter',
      'Ice',
    ],
    steps: ['Blend everything until smooth.', 'Drink within 30 min post-workout.'],
    tags: ['post-workout', 'quick'],
  },
]

// Optionally merge content collected from your own Centr account.
// scripts/centr-collect.mjs writes JSON into src/data/centr/ (gitignored).
// Zero files = this is a no-op, app runs on seed content alone.
const collected = import.meta.glob<{ default: { workouts?: Workout[]; programs?: Program[]; recipes?: Recipe[] } }>(
  './centr/*.json',
  { eager: true },
)
for (const mod of Object.values(collected)) {
  const data = mod.default
  if (data.workouts) workouts.push(...data.workouts)
  if (data.programs) programs.push(...data.programs)
  if (data.recipes) recipes.push(...data.recipes)
}

export const allWorkoutsById = Object.fromEntries(workouts.map((w) => [w.id, w]))
export const allProgramsById = Object.fromEntries(programs.map((p) => [p.id, p]))
export const allRecipesById = Object.fromEntries(recipes.map((r) => [r.id, r]))
