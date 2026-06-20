// In-app "What's new" — surfaced via the bell in the top bar (newest first).
// Add a block when a user-facing batch ships to prod.
export interface Release { date: string; title: string; items: string[] }

export const releases: Release[] = [
  {
    date: '2026-06-20',
    title: 'Richer library + reliability',
    items: [
      'Step-by-step "How to" instructions on 868 exercises',
      'New Yoga and Pilates categories',
      'Cleaner equipment filters (Dumbbell, Barbell, Bodyweight, Cable…)',
      'Swipe left/right in a workout to change exercise',
      'Behind the scenes: automatic health monitoring keeps the app up',
    ],
  },
  {
    date: '2026-06-20',
    title: 'Bigger library + a much better gym session',
    items: [
      '806 new exercises and 664 new recipes added to the library',
      'Workout player: rest timer between sets, kg/lb toggle, clear set tracker, add or skip a set',
      'See a time estimate and reorder exercises before you start',
      'Finished workouts now show ✓ Done on Today',
      'Pair a heart-rate monitor or trainer during a ride (mid-ride)',
      'Substitute now keeps the same type (workout↔workout, meal↔meal…)',
      'Cleaner recipe steps, bigger back buttons, and a refreshed logo',
    ],
  },
]
