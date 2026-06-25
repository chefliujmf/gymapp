# Source Library Workflow

This file defines how the coach turns useful Centr links and book-derived ideas into durable coaching libraries.

## Purpose

Whenever the coach recommends a specific meal, snack, recipe, workout, exercise, mobility session, or recovery action from Centr or the reference books, use that moment to improve the reusable library.

The goal is to gradually build:
- the coach's own performance cookbook for practical athlete meals and snacks;
- the coach's own exercise and mobility library for repeatable gym, prehab, and recovery prescriptions;
- a source trail that shows where an idea came from without copying protected recipe or book text.

Think of these files as the coach's reusable books. Centr and the reference books are source material; the local cookbook and exercise library are the athlete-specific, rewritten, reusable layer.

## Source Verification

This is the single definition of "verified" used across the Centr/JOIN rules.

A Centr or JOIN reference is **verified** once its exact URL/title has been confirmed to resolve to a
real item — via the logged-in Centr session (`tools/centr_select_workout.py`) or the athlete
confirming the link opens. Until then it is **unverified**. Publishing rules by state:

- **Verified exact URL** — preferred. Publish the link as attribution/execution support.
- **Unverified but specifically named** item or program (e.g. a named Centr program like
  `Strength for Sports`, or a named recipe title) — allowed only as a **labeled fallback**: mark it
  `unverified` / `inspect in-app` so the athlete is never told it is confirmed. Promote it to a
  verified entry once the URL/title is confirmed.
- **Vague search keywords** (`snack`, `core`, `mobility`, `full body strength`, `smoothie`) — never
  publish. Prescribe the plain food/exercise with quantities, sets, reps, and effort instead.

This resolves the apparent tension: vague keywords are banned, verified URLs are preferred, and
specific-but-unverified named items are allowed *only when explicitly labeled as unverified*.

## Mandatory Capture Rule

When a recommendation uses an exact verified Centr URL or a clearly identified book-derived idea:

1. Check whether the item already exists in:
   - [cookbook.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/cookbook.md>)
   - [exercise_library.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/exercise_library.md>)
2. If it is new, add a short reusable entry before or at the same time as using it in a workout plan or analysis.
3. If it already exists but the new use teaches something useful, add a brief `Coach notes` update instead of duplicating the entry.

This capture step applies to:
- JOIN workout patterns and publicly visible workout descriptions;
- Centr recipes and snacks;
- Centr workouts, articles, and exercise tutorials;
- recipe templates adapted from sports nutrition books;
- gym, mobility, prehab, and recovery exercises adapted from coaching references;
- athlete-tested variations that worked or failed.

## Offline Resilience Rule

The local books should remain useful when JOIN, Centr, or another source site is unavailable.

For every useful external item, save enough coach-owned information to prescribe it later without live access:
- source name, exact URL, and source type;
- what the source item is for;
- why it fits or does not fit Jean-Manuel;
- the coach-owned default prescription with quantities, durations, targets, sets, reps, rest, effort, or nutrition amounts as relevant;
- substitutions and progressions;
- cycling cost, recovery cost, and stop/downgrade rules;
- athlete feedback once tested.

Do not save external material as a link-only placeholder. A broken link should not break the coach's ability to prescribe the adapted version.

## Copyright And Source Rules

Do not copy full recipes, instructions, ingredient lists, images, exercise scripts, or book passages into the repo.

For JOIN workout patterns:
- store the exact URL, title, source type, duration, and the high-level training idea;
- write a coach-owned version with athlete-specific targets, caps, substitutions, and stop rules;
- do not copy full workout files, proprietary step text, images, or app-only details.

For Centr links:
- store the exact URL, title, source type, and why it fits the athlete;
- write the coach's own training-use summary;
- include only brief visible facts that are needed for identification;
- avoid reproducing the full recipe or workout content.

For books:
- capture principles and original coach-created templates in the coach's own words;
- cite the source book as inspiration;
- do not transcribe protected recipe directions or long passages.

If a full recipe needs to be executed, link back to the source or write a materially original coach version with different wording, quantities, and method.

## Cookbook Entry Standard

Each cookbook entry should include:
- name;
- source and exact URL or book inspiration;
- category: pre-ride, during-ride, recovery, dinner, snack, late meal, rest day;
- best use case by session type;
- vegetarian suitability;
- training purpose;
- practical portion guidance when known or coach-created;
- coach adaptation notes;
- athlete feedback once tested.

## Exercise Library Entry Standard

Each exercise or session entry should include:
- name;
- source and exact URL or book inspiration;
- category: strength, mobility, prehab, trunk, recovery, warmup, cycling workout pattern;
- movement pattern;
- best use case by workout type;
- default prescription: sets, reps, duration, rest, effort, or bike power/cadence/RPE targets as relevant;
- substitutions;
- cycling cost and stop rules;
- athlete feedback once tested.

## Recommendation Output Rule

When publishing a workout or analysis, prefer the local library entry first, then include the exact verified source link when available.

Example:

```text
Centr recipe: Swirled Banana & Oat Pots - https://centr.com/recipe/show/32848/swirled-banana-oat-pots
Library use: cookbook / pre-ride carb-forward breakfast
```

Do not expose internal library maintenance notes in every athlete-facing workout unless they help execution.

## Reuse Rule

Before suggesting a new Centr recipe, snack, workout, or exercise, check whether the local cookbook or exercise library already has a suitable entry.

Use a new external source when:
- the local library has no good match for the session;
- the athlete asks for more variety;
- prior feedback shows the local entry did not work;
- the training context needs a different nutrition or movement pattern.

When a local entry works, recommend it as the coach-owned option and keep the external link as attribution or execution support.
