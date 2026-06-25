# Nutrition And Centr Workflow

Nutrition recommendations should be attached to the workout, not treated as a separate generic meal plan.

## Where The Athlete Sees It

The coach should publish fueling, meal/snack, and supplement guidance inside the Intervals.icu planned workout description under:

```text
Fueling / Meals / Supplements
```

The coach should also publish practical recovery guidance under:

```text
Recovery Actions
```

This keeps the guidance visible on the same calendar item as the ride or gym session.

Completed-activity coach feedback should also include the recovery food link under `Recovery / Supplements > Nutrition`. Food is part of recovery, not only planning.

If the Intervals.icu note does not render the Centr URL as clickable, still include the raw URL for copy/paste in the note when useful. Do not duplicate the full planned workout in a custom field; Intervals retains the original plan on the paired planned event.

The section should include:
- `Pre`: what to eat and when before the session;
- `During`: carbs, water, or electrolytes during the session;
- `Post`: recovery meal/snack priority;
- `Centr recipe`: one exact verified recipe link when available, or a plain-food fallback if no verified link is available;
- `Supplements`: today's workout needs plus daily baseline supplement context.

Completed-activity recovery feedback should include:
- `Food link`: the local cookbook entry plus exact Centr recipe link when available;
- if no exact link is verified, the plain-food fallback or cookbook template.
- `Trace`: a short note that the paired Intervals planned workout retains the original plan when the planned workout had useful food, recipe, exercise, or supplement context worth keeping.

Always include quantities for planned workout fueling:
- pre-ride snack carbs in grams when a snack is suggested;
- during-ride carbs in grams per hour when relevant;
- post-workout protein in grams, and carbs in grams when relevant;
- approximate fluid guidance when useful, e.g. `400-750ml/hour` adjusted by heat and thirst.

The recovery section should include:
- `Post-session`: what to do immediately after the workout;
- `Evening`: what matters later that day;
- `Next morning check`: what decides whether to progress, hold, or recover.

## Source Priority

Use:
- the sports nutrition, supplements, and recovery books for principles;
- the local performance cookbook for reusable athlete-specific meals and snacks;
- the current training plan for timing and carbohydrate needs;
- Centr for practical meal and snack options;
- athlete feedback for what actually works.

The local cookbook is the first reusable layer. Centr and the reference books are source material for building it.

## How Meals And Snacks Are Suggested

For each planned day, classify the session:

| Session type | Fueling goal | Centr meal / snack bias |
| --- | --- | --- |
| Rest or mobility | normal balanced eating | simple protein-forward meals, vegetables, normal carbs |
| Easy ride under 75 min | avoid underfueling, no special protocol | normal meal, optional small carb snack if hungry |
| Endurance 90-180 min | protect durability | carb-forward pre-ride meal, ride carbs, recovery meal |
| Sweet spot / threshold | support quality | carb-forward meal 2-4h before, easy carb snack if needed |
| Gym strength | support repair without excess fatigue | protein-forward meal, carbs if paired with ride or late session |
| Late dinner / poor sleep risk | protect next day | lighter digestible meal, avoid alcohol-heavy or very late heavy meal |

## Practical Defaults

Before easy ride:
- normal meal is enough if the ride is short;
- add a small carb snack if starting hungry.
- supplements: none required unless heat, heavy sweating, or missed meals create a specific need.

Before quality or long ride:
- carb-forward meal 2-4 hours before;
- optional simple carb snack 30-60 minutes before.

During long ride:
- start fueling in the first 30 minutes;
- use carbs per hour appropriate to duration and gut tolerance;
- record what worked in activity notes if anything went wrong.

After gym:
- protein-forward meal or snack;
- add carbs if the next day includes bike work.
- protein powder is a convenience option only if normal food is not practical.

After long or hard ride:
- carbs plus protein;
- simple recovery meal if dinner will be delayed.
- electrolytes/sodium are useful when sweat loss is high; otherwise normal food and fluids are enough.

Recovery:
- protect sleep first;
- hydrate to thirst and replace normal meals rather than chasing special recovery hacks;
- use easy walking, light mobility, or breathing only if it leaves the athlete feeling fresher;
- check HRV, resting HR, sleep, legs, and subjective fatigue the next morning before adding load.

## Centr Exact Links

Use exact verified Centr recipe, meal, snack, workout, or exercise links. Do not publish broad search terms such as `snack`, `yogurt`, `smoothie`, `mobility`, `full body strength`, or `core`. If no verified link exists, write a simple food or exercise fallback with quantities, sets, reps, and effort target instead of asking the athlete to search. A *specifically named* but not-yet-URL-verified Centr program or recipe may be used only as a labeled `unverified`/`inspect in-app` fallback — see "Source Verification" in [source_library_workflow.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/source_library_workflow.md>) for the single definition of verified vs unverified.

Before recommending a new Centr meal or snack, check [cookbook.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/cookbook.md>). If the source is new and useful, add it to the cookbook using [source_library_workflow.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/source_library_workflow.md>) so future coaching can reuse it from the coach's own cookbook.

Do not repeat the same Centr recipe link across consecutive similar workouts unless it is clearly the best fit or the athlete asks for it. If the only direct recipe links available would be repetitive, use a coach-owned cookbook fallback with quantities, or cite a Centr collection link with the exact recipe title instead of forcing the same oat/smoothie link again.

Verified Centr recipe links currently available:
- Swirled Banana & Oat Pots: `https://centr.com/recipe/show/32848/swirled-banana-oat-pots`
- Salted Caramel Super Smoothie: `https://centr.com/recipe/show/12693/salted-caramel-super-smoothie`
- Plant Proof Protein Bowl: `https://centr.com/recipe/show/16548/plant-proof-protein-bowl`
- Banana & Raspberry Overnight Oats: `https://centr.com/recipe/4940`

Verified Centr collection links with exact recipe titles. Use these when variety matters and no direct individual recipe URL has been verified yet:
- 7 plant-based recipes that are high in protein: `https://centr.com/blog/show/28922/7-plant-based-recipes-that-are-high-in-protein`
  - Dan's Honey Soy Tofu with Greens & Quinoa
  - Tofu Shakshuka
  - High-protein Lentil Braise with Flatbread
  - Spicy Red Pepper Soup with Crispy Chickpeas
- 10 recipes to eat your way to muscle recovery: `https://centr.com/article/show/12167/10-recipes-to-eat-your-way-to-recovery`
  - Simon's Asian Bowl with Roasted Vegetables & Tofu
  - Almond, Date & Banana Smoothie
  - Almond & Blueberry Smoothie
  - Ricotta Omelette with Garlic Tomatoes
- 10 high-protein recipes for easy meal prep: `https://centr.com/blog/show/32824/10-high-protein-recipes-for-easy-meal-prep`
  - Dan's Orange Tofu & Brown Rice Bento Box
  - Creamy Roasted Tofu & Cauliflower Korma
  - High-protein Lentil Braise with Flatbread

Verified Centr workout/exercise links currently available:
- Centr Fusion: PowerFlow: `https://centr.com/workout/overview/0/13740/fusion-powerflow-move-to-release`
- Centr Align: Pilates Day 1: `https://centr.com/workout/overview/0/14536/align-pilates-1-sylvia-with-tahl`
- Tutorial - Cable Romanian deadlift: `https://centr.com/article/show/32423/power-shred-tutorial-cable-romanian-deadlift`
- Dumbbell leg workout article, including dumbbell Romanian deadlift: `https://centr.com/blog/show/27279/dumbbell-leg-workouts`

Fallback rule:
- if the coach has no exact verified Centr link, do not give keywords;
- prescribe the plain food, recipe type, exercise, sets, reps, rest, and target effort directly;
- write `No exact Centr link verified yet` only when useful for clarity.
- if using a Centr collection link, name the exact recipe title and say `collection link` so the athlete is not left with a vague search instruction.
- if the plain-food fallback becomes useful repeatedly, convert it into a cookbook template with source inspiration and athlete feedback.
- in completed-activity feedback, still include `Food link` and point to the cookbook fallback when no Centr URL exists.
- when a recipe, snack, or recovery food is recommended after a completed activity, consult the paired Intervals planned event for the original planned nutrition/recovery context.

## Coach Output Format

When suggesting nutrition, keep it short:

```text
Fueling:
- Pre: [meal/snack timing]
- During: [carb target if needed]
- Post: [meal/snack priority]
- Centr recipe: [exact verified link, or plain-food fallback with quantities]
- Supplements: [today's workout need plus daily baseline supplement context]

Recovery:
- Post-session: [immediate action]
- Evening: [sleep/meal/hydration priority]
- Next morning check: [go/no-go signal]
```

## Rules

- Do not recommend supplements casually.
- Do not prescribe aggressive underfueling.
- If a session is moved because of weather or family schedule, move the fueling advice with it.
- If RPE is high despite normal power, check sleep and fueling before raising training load.
- If the athlete notes GI issues, simplify ride fuel before increasing carb targets.
