import type { Workout, Program, Recipe, Trainer, MindSession, MealPlanDay } from '../types'

// ---------------------------------------------------------------------------
// Muscle / hypertrophy catalog. Body-part splits with real set × rep × rest
// prescriptions and a per-exercise demo link (MuscleWiki search).
// videoUrl is blank — point it at your Emby stream URLs when ready.
// ---------------------------------------------------------------------------

const demo = (name: string) =>
  `https://musclewiki.com/exercises?search=${encodeURIComponent(name)}`

export const workouts: Workout[] = [
  {
    id: 'w-push',
    title: 'Push Day — Chest, Shoulders, Triceps',
    discipline: 'strength',
    duration: 50,
    level: 'intermediate',
    equipment: ['barbell', 'dumbbells', 'bench', 'cable machine'],
    summary: 'Horizontal and vertical pressing with triceps to finish. Build the front of the body.',
    coach: 'Alex Rivera',
    calories: 360,
    exercises: [
      { name: 'Barbell Bench Press', prescription: '4 x 6-8', note: 'Rest 2 min. Control the eccentric.', demoUrl: demo('barbell bench press') },
      { name: 'Incline Dumbbell Press', prescription: '3 x 8-10', note: 'Rest 90s.', demoUrl: demo('incline dumbbell press') },
      { name: 'Seated Dumbbell Shoulder Press', prescription: '3 x 8-10', note: 'Rest 90s.', demoUrl: demo('seated dumbbell shoulder press') },
      { name: 'Cable Lateral Raise', prescription: '3 x 12-15', note: 'Rest 60s. Slow and strict.', demoUrl: demo('cable lateral raise') },
      { name: 'Cable Triceps Pushdown', prescription: '3 x 12', note: 'Rest 60s.', demoUrl: demo('triceps pushdown') },
      { name: 'Overhead Dumbbell Extension', prescription: '3 x 12', note: 'Rest 60s.', demoUrl: demo('overhead dumbbell triceps extension') },
    ],
  },
  {
    id: 'w-pull',
    title: 'Pull Day — Back & Biceps',
    discipline: 'strength',
    duration: 50,
    level: 'intermediate',
    equipment: ['barbell', 'dumbbells', 'pull-up bar', 'cable machine'],
    summary: 'Vertical and horizontal pulling for a wide, thick back, plus biceps.',
    coach: 'Alex Rivera',
    calories: 350,
    exercises: [
      { name: 'Weighted Pull-Up', prescription: '4 x 6-8', note: 'Rest 2 min. Full hang to chin over bar.', demoUrl: demo('pull up') },
      { name: 'Barbell Bent-Over Row', prescription: '4 x 8', note: 'Rest 90s. Flat back, pull to the hip.', demoUrl: demo('barbell bent over row') },
      { name: 'Lat Pulldown', prescription: '3 x 10-12', note: 'Rest 75s.', demoUrl: demo('lat pulldown') },
      { name: 'Seated Cable Row', prescription: '3 x 10-12', note: 'Rest 75s.', demoUrl: demo('seated cable row') },
      { name: 'Face Pull', prescription: '3 x 15', note: 'Rest 60s. Rear delts and upper back.', demoUrl: demo('face pull') },
      { name: 'Dumbbell Hammer Curl', prescription: '3 x 10-12', note: 'Rest 60s.', demoUrl: demo('dumbbell hammer curl') },
    ],
  },
  {
    id: 'w-legs',
    title: 'Leg Day — Quads, Hamstrings, Glutes',
    discipline: 'strength',
    duration: 55,
    level: 'advanced',
    equipment: ['barbell', 'leg press', 'leg curl machine'],
    summary: 'Heavy compound squatting and hinging with accessory work for full leg development.',
    coach: 'Alex Rivera',
    calories: 420,
    exercises: [
      { name: 'Barbell Back Squat', prescription: '4 x 6-8', note: 'Rest 2-3 min. Hit depth, brace hard.', demoUrl: demo('barbell back squat') },
      { name: 'Romanian Deadlift', prescription: '4 x 8', note: 'Rest 2 min. Feel the hamstring stretch.', demoUrl: demo('romanian deadlift') },
      { name: 'Leg Press', prescription: '3 x 10-12', note: 'Rest 90s.', demoUrl: demo('leg press') },
      { name: 'Seated Leg Curl', prescription: '3 x 12', note: 'Rest 75s.', demoUrl: demo('seated leg curl') },
      { name: 'Walking Lunge', prescription: '3 x 12 / leg', note: 'Rest 75s.', demoUrl: demo('walking lunge') },
      { name: 'Standing Calf Raise', prescription: '4 x 15', note: 'Rest 45s. Full range, pause at top.', demoUrl: demo('standing calf raise') },
    ],
  },
  {
    id: 'w-arms',
    title: 'Arms — Biceps & Triceps',
    discipline: 'strength',
    duration: 35,
    level: 'beginner',
    equipment: ['dumbbells', 'ez bar', 'cable machine'],
    summary: 'A dedicated arm pump session — supersets for biceps and triceps.',
    coach: 'Dev Okafor',
    calories: 240,
    exercises: [
      { name: 'EZ-Bar Curl', prescription: '4 x 10', note: 'Rest 60s.', demoUrl: demo('ez bar curl') },
      { name: 'Close-Grip Bench Press', prescription: '4 x 8-10', note: 'Rest 90s.', demoUrl: demo('close grip bench press') },
      { name: 'Incline Dumbbell Curl', prescription: '3 x 12', note: 'Rest 60s.', demoUrl: demo('incline dumbbell curl') },
      { name: 'Cable Triceps Pushdown', prescription: '3 x 12-15', note: 'Rest 60s.', demoUrl: demo('triceps pushdown') },
      { name: 'Hammer Curl', prescription: '3 x 12', note: 'Rest 45s.', demoUrl: demo('hammer curl') },
    ],
  },
  {
    id: 'w-upper',
    title: 'Upper Body Strength',
    discipline: 'strength',
    duration: 45,
    level: 'intermediate',
    equipment: ['barbell', 'dumbbells', 'bench'],
    summary: 'A balanced upper-body session hitting push and pull in one go.',
    coach: 'Alex Rivera',
    calories: 320,
    exercises: [
      { name: 'Barbell Overhead Press', prescription: '4 x 6-8', note: 'Rest 2 min.', demoUrl: demo('barbell overhead press') },
      { name: 'Dumbbell Bench Press', prescription: '4 x 8-10', note: 'Rest 90s.', demoUrl: demo('dumbbell bench press') },
      { name: 'Chest-Supported Row', prescription: '4 x 10', note: 'Rest 90s.', demoUrl: demo('chest supported row') },
      { name: 'Lat Pulldown', prescription: '3 x 12', note: 'Rest 75s.', demoUrl: demo('lat pulldown') },
      { name: 'Dumbbell Lateral Raise', prescription: '3 x 15', note: 'Rest 45s.', demoUrl: demo('dumbbell lateral raise') },
    ],
  },
  {
    id: 'w-fullbody',
    title: 'Full Body Hypertrophy',
    discipline: 'strength',
    duration: 50,
    level: 'beginner',
    equipment: ['barbell', 'dumbbells', 'bench'],
    summary: 'One movement per major pattern — great for 2-3x/week full-body training.',
    coach: 'Mia Chen',
    calories: 380,
    exercises: [
      { name: 'Goblet Squat', prescription: '4 x 10', note: 'Rest 90s.', demoUrl: demo('goblet squat') },
      { name: 'Dumbbell Bench Press', prescription: '4 x 10', note: 'Rest 90s.', demoUrl: demo('dumbbell bench press') },
      { name: 'One-Arm Dumbbell Row', prescription: '4 x 10 / side', note: 'Rest 75s.', demoUrl: demo('one arm dumbbell row') },
      { name: 'Romanian Deadlift', prescription: '3 x 10', note: 'Rest 90s.', demoUrl: demo('romanian deadlift') },
      { name: 'Plank', prescription: '3 x 45s', note: 'Rest 45s.', demoUrl: demo('plank') },
    ],
  },
  // --- Yoga & Pilates: follow-along recovery / mobility sessions ---
  {
    id: 'w-yoga-flow',
    title: 'Morning Yoga Flow',
    discipline: 'yoga',
    duration: 25,
    level: 'beginner',
    equipment: ['mat'],
    summary: 'A gentle vinyasa flow to wake the body and open the hips, spine and shoulders.',
    coach: 'Mia Chen',
    calories: 110,
  },
  {
    id: 'w-yoga-recovery',
    title: 'Recovery Yoga',
    discipline: 'yoga',
    duration: 30,
    level: 'beginner',
    equipment: ['mat'],
    summary: 'Slow, restorative holds for the day after a heavy lift. Breathe and release.',
    coach: 'Mia Chen',
    calories: 90,
  },
  {
    id: 'w-pilates-core',
    title: 'Pilates Core',
    discipline: 'pilates',
    duration: 20,
    level: 'beginner',
    equipment: ['mat'],
    summary: 'Mat Pilates for deep trunk control and a strong, stable midline.',
    coach: 'Mia Chen',
    calories: 120,
  },
  {
    id: 'w-pilates-full',
    title: 'Full Body Pilates',
    discipline: 'pilates',
    duration: 35,
    level: 'intermediate',
    equipment: ['mat'],
    summary: 'A flowing mat session building control, mobility and endurance head to toe.',
    coach: 'Mia Chen',
    calories: 160,
  },
]

export const programs: Program[] = [
  {
    id: 'p-hypertrophy-ppl',
    title: 'Hypertrophy Foundations',
    discipline: 'strength',
    weeks: 6,
    daysPerWeek: 6,
    level: 'intermediate',
    summary: 'A 6-week push / pull / legs split to build size and strength. Train 6 days, rest 1.',
    schedule: [
      { day: 1, label: 'Push', workoutId: 'w-push' },
      { day: 2, label: 'Pull', workoutId: 'w-pull' },
      { day: 3, label: 'Legs', workoutId: 'w-legs' },
      { day: 4, label: 'Push', workoutId: 'w-push' },
      { day: 5, label: 'Pull', workoutId: 'w-pull' },
      { day: 6, label: 'Legs', workoutId: 'w-legs' },
      { day: 7, label: 'Rest', workoutId: null },
    ],
  },
  {
    id: 'p-upper-lower',
    title: 'Upper / Lower Build',
    discipline: 'strength',
    weeks: 4,
    daysPerWeek: 4,
    level: 'beginner',
    summary: 'A 4-day upper/lower split — a sustainable way to build muscle around a busy week.',
    schedule: [
      { day: 1, label: 'Upper', workoutId: 'w-upper' },
      { day: 2, label: 'Lower', workoutId: 'w-legs' },
      { day: 3, label: 'Rest', workoutId: null },
      { day: 4, label: 'Upper', workoutId: 'w-upper' },
      { day: 5, label: 'Lower', workoutId: 'w-legs' },
      { day: 6, label: 'Arms (optional)', workoutId: 'w-arms' },
      { day: 7, label: 'Rest', workoutId: null },
    ],
  },
]

// Vegetarian by default — original recipes with high-protein, lifter-friendly macros.
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
    ingredients: ['60g rolled oats', '1 scoop vanilla protein', '200ml milk of choice', '1 tbsp chia seeds', '1/2 banana, sliced', 'Handful of berries'],
    steps: ['Combine oats, protein, chia and milk in a jar.', 'Stir well, top with banana and berries.', 'Refrigerate overnight. Eat cold.'],
    tags: ['high-protein', 'meal-prep', 'vegetarian'],
    diet: ['high-protein', 'vegetarian'],
  },
  {
    id: 'r-tofu-rice-bowl',
    title: 'Crispy Tofu & Rice Power Bowl',
    category: 'lunch',
    minutes: 25,
    kcal: 540,
    protein: 34,
    carbs: 64,
    fat: 16,
    ingredients: ['200g firm tofu, cubed', '1 cup cooked brown rice', '1 cup roasted veg', 'Avocado, 1/4', '1 tbsp soy sauce, sesame, lime'],
    steps: ['Press tofu, toss in soy + cornstarch, pan-fry until crisp.', 'Warm rice and roasted veg.', 'Assemble bowl, top with avocado, sesame and lime.'],
    tags: ['high-protein', 'post-workout', 'vegetarian'],
    diet: ['high-protein', 'vegetarian'],
  },
  {
    id: 'r-halloumi-traybake',
    title: 'Halloumi & Chickpea Traybake',
    category: 'dinner',
    minutes: 30,
    kcal: 520,
    protein: 33,
    carbs: 38,
    fat: 26,
    ingredients: ['120g halloumi, sliced', '1 can chickpeas, drained', 'Broccoli & peppers', 'Sweet potato, 1 small', 'Olive oil, paprika, garlic'],
    steps: ['Roast sweet potato + chickpeas 20 min at 200°C with spices.', 'Add halloumi and veg for the last 12 min.', 'Finish with lemon and herbs.'],
    tags: ['high-protein', 'vegetarian'],
    diet: ['high-protein', 'vegetarian', 'gluten-free'],
  },
  {
    id: 'r-lentil-curry',
    title: 'Red Lentil & Spinach Curry',
    category: 'dinner',
    minutes: 25,
    kcal: 480,
    protein: 26,
    carbs: 66,
    fat: 12,
    ingredients: ['1 cup red lentils', '1 can chopped tomatoes', '2 handfuls spinach', 'Coconut milk, 1/2 can', 'Onion, garlic, curry spices', 'Rice to serve'],
    steps: ['Soften onion and garlic, add spices.', 'Add lentils, tomatoes and coconut milk; simmer 18 min.', 'Stir through spinach, serve over rice.'],
    tags: ['high-protein', 'vegan', 'batch-cook'],
    diet: ['high-protein', 'vegan', 'vegetarian', 'gluten-free'],
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
    ingredients: ['1 scoop protein', '1 banana', '200ml milk', '1 tbsp peanut butter', 'Ice'],
    steps: ['Blend everything until smooth.', 'Drink within 30 min post-workout.'],
    tags: ['post-workout', 'quick', 'vegetarian'],
    diet: ['high-protein', 'vegetarian'],
  },
]

export const trainers: Trainer[] = [
  { id: 't-alex', name: 'Alex Rivera', specialty: 'Strength & Hypertrophy', bio: 'Builds size and strength with progressive overload and clean technique.', disciplines: ['strength'] },
  { id: 't-mia', name: 'Mia Chen', specialty: 'Mobility & Foundations', bio: 'Smart full-body training and mobility to keep you building injury-free.', disciplines: ['strength', 'mobility', 'yoga'] },
  { id: 't-dev', name: 'Dev Okafor', specialty: 'Arms & Conditioning', bio: 'High-volume pump work and conditioning to round out your physique.', disciplines: ['strength', 'hiit'] },
]

export const mindSessions: MindSession[] = [
  { id: 'm-calm', title: 'Calm the Noise', kind: 'meditation', duration: 10, summary: 'A guided sit to settle a busy mind.', coach: 'Mia Chen' },
  { id: 'm-box-breath', title: 'Box Breathing', kind: 'breathwork', duration: 6, summary: '4-4-4-4 breathing to steady the nervous system.', coach: 'Dev Okafor' },
  { id: 'm-sleep', title: 'Wind Down for Sleep', kind: 'sleep', duration: 20, summary: 'A slow body-scan to ease into rest.', coach: 'Mia Chen' },
  { id: 'm-focus', title: 'Pre-Lift Focus', kind: 'focus', duration: 5, summary: 'Short priming session before you train.', coach: 'Alex Rivera' },
]

export const mealPlan: MealPlanDay[] = [
  { day: 1, breakfast: 'r-protein-oats', lunch: 'r-tofu-rice-bowl', dinner: 'r-halloumi-traybake', snack: 'r-recovery-smoothie' },
  { day: 2, breakfast: 'r-protein-oats', lunch: 'r-tofu-rice-bowl', dinner: 'r-lentil-curry', snack: 'r-recovery-smoothie' },
  { day: 3, breakfast: 'r-protein-oats', lunch: 'r-lentil-curry', dinner: 'r-halloumi-traybake', snack: 'r-recovery-smoothie' },
  { day: 4, breakfast: 'r-protein-oats', lunch: 'r-tofu-rice-bowl', dinner: 'r-lentil-curry', snack: 'r-recovery-smoothie' },
  { day: 5, breakfast: 'r-protein-oats', lunch: 'r-halloumi-traybake', dinner: 'r-tofu-rice-bowl', snack: 'r-recovery-smoothie' },
  { day: 6, breakfast: 'r-protein-oats', lunch: 'r-tofu-rice-bowl', dinner: 'r-halloumi-traybake', snack: 'r-recovery-smoothie' },
  { day: 7, breakfast: 'r-protein-oats', lunch: 'r-lentil-curry', dinner: 'r-tofu-rice-bowl', snack: 'r-recovery-smoothie' },
]

// Optionally merge content collected from your own Centr account.
// scripts/centr-collect.mjs writes JSON into src/data/centr/ (gitignored).
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
export const allTrainersById = Object.fromEntries(trainers.map((t) => [t.id, t]))
export const allMindById = Object.fromEntries(mindSessions.map((m) => [m.id, m]))
