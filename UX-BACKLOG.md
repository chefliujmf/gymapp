# Platyplus — UX / UI backlog

Captured from product direction. Tackle after: (1) media self-hosting flip,
(2) house_inspector PWA. Roughly priority-ordered.

## Calendar (the centerpiece)
- Make the calendar **big and modern, close to Google Calendar**: Day / Week /
  Month / Year / Schedule views; clean event blocks; today highlighted.
- Everything (workouts, rides, runs, meals, mind) is an **event on the calendar**,
  assigned to a day. The calendar replaces the "Day 1/2/3" framing.
- Current calendar feels empty/sparse ("not really an activity planned") — needs
  density + visual polish.

## Gym
- **Flip the model: workouts first, exercises second.** Land on workouts: either
  **select an existing workout** or **build one**.
- **Workout builder**: build a workout WITHOUT assigning it to a day; **save &
  reuse** it any number of times. (Library of reusable workouts.)

## Ride & Run
- A **builder for rides** (structured power/interval workout) and the **same for
  runs**, reusable like gym workouts.

## Eat (meals)
- Show a **list of meals** (drop the Day 1/2/3 structure — the calendar handles days).
- **Create / add new meals.**
- **Meal packs**: pre-packaged breakfast / lunch / snack "packs" (like a day's set)
  that roll up **kcal + protein** for the pack. (User specifically likes this.)
- **Assign meals (and snacks) to days** via the calendar.
- **Shopping list generator**: for selected days (or a full week), generate a
  consolidated shopping list from the assigned meals **+ snacks**.

## Recipes
- **All-recipes page is missing a back/return arrow** (bug — add it).
- From a recipe: an **easy way to add it to the calendar and assign a day**.

## Mind
- Same as recipes: **assign a mind/meditation session to a day** from its page.

## Cross-cutting
- Consistent "add to calendar → pick day" affordance across recipes, mind,
  workouts, rides, runs.
- Reusable-template concept shared by gym/ride/run workouts and meal packs.
