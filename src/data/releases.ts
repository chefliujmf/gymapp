// In-app "What's new" — surfaced via the bell in the top bar (newest first).
// Add a block when a user-facing batch ships to prod.
export interface Release { date: string; title: string; items: string[] }

export const releases: Release[] = [
  {
    date: '2026-06-23',
    title: 'Big update — coach, progress, sensors & more',
    items: [
      'Your coach can now post you notes — they show up here in the bell',
      'Set your diet (vegetarian/vegan) and every meal the coach picks respects it',
      'Progress is now real insights: weekly volume, PRs, strength trends per lift (searchable, by muscle group), muscle balance & coach takeaways',
      'History is grouped by day — your check-in and sessions together — with delete and kg/lb',
      'Cleaner nav: Eat is its own tab, Mind lives under Train, no more “More”',
      'Ride player: your live power as a big gauge vs the target, plus a 1% intensity dial for tough days',
      'Connect a heart-rate strap or smart trainer (a ＋ on each); riding is mobile-first',
      'Post-gym summary: volume, top sets, est-1RM, muscles hit and a coach tip',
      'Completed workouts get a clear ✓ badge and colourful stat chips',
      'Lots of polish — readable contrast, wrapped chips, week-strip dots, one-tap Add',
    ],
  },
  {
    date: '2026-06-23',
    title: 'Simpler daily check-in',
    items: [
      'Energy, Sleep and Soreness are now a quick 1–5 tap (with a tap-able ⓘ explaining each)',
      'Once you’ve logged, it collapses to a tidy one-line summary you can edit',
    ],
  },
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
