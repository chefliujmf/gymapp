---
name: platyplus-testing
description: Test + verification discipline for Platyplus — log every report first, write a test with every fix, "built ≠ done" (only JM marks ✅), keep the 🧪 Test guide section of FEEDBACK-LOG.md current. Use on EVERY bug fix or feature, before claiming anything works.
---

# Test & verify (Platyplus) — earn the ✅

**Why this exists (JM, 2026-06-26):** I shipped a pile of "built" code that didn't work and
didn't log JM's reports, so they got lost and he had to repeat them. Trust broke. This is how
it doesn't happen again.

## Priority order (JM 2026-07-09) — work the queue in THIS order
**We fix what's BROKEN first. Features + ideas wait until ZERO bugs remain and everything works as expected**
("we work on things that don't work first; once no bugs are reported and all works as expected, then we can work
on ideas and features"). So: **clear ALL bugs before touching ANY feature/idea.** Within bugs: a tested-and-FAILED
bug is highest ("bug = things we do first"; "tested failed, highest priority"). A failed **feature/idea does NOT
jump the queue** — it stays at its own (usually med/low) priority ("[#255 is] a feature, not high priority and not
a bug"). Order: 1) **failed bugs** → 2) **open bugs** → 3) (only when no bugs left) features/ideas by their own
priority. Don't sink time into a med feature (e.g. #255) while any bug is open. Type/priority = JM's triage overlay.

## The 10-at-a-time bug pipeline (JM 2026-07-09) — how we drive to ZERO
Fill the **`totest` bucket to exactly 10**. **JM reviews ONLY when `totest == 10`** (not a partial batch).
- **PROMOTE at `totest == 10`** (JM: "promote when tested is at 10 items"). The moment the bucket fills to 10,
  push + **promote dev → prod** so the whole batch is LIVE on prod — JM tests **on prod**, where everything works
  (incl. coach-only features like the horizon #439 / recovery #451 that QA can't exercise). This is why we ship the
  batch before he reviews: it makes every item testable in one place.
- **JM tests on prod → `pass` or `fail`.** A **`pass` → mark it `done`** — it's already on prod from the batch
  promote (JM 2026-07-09, "very important": tested-OK ⇒ promoted + `done`). A **`fail` → I rework** it (bug I own);
  it re-enters a later batch and ships on that batch's promote. Marking `pass`/`fail` empties the bucket.
- **REFILL TRIGGER = `totest == 0`** (JM: "as soon as to test is at 0, trigger a review of bugs and items and
  start working on 10"). The moment it hits 0: (1) mark the passes `done`; (2) rework the fails; (3) **RE-REVIEW
  the whole backlog** with JM's LATEST triage (new reports, reprioritizations, type/priority/area) — don't work a
  stale list; reconcile already-fixed-but-stale `todo` bugs (verify the `#NNN` code ref + test → `totest`) and fix
  the genuinely-open ones; (4) fill the next 10 → **promote at 10** again.
Repeat until **0 bugs** (then, and only then, features/ideas — order per "Priority order"). Poll the `totest`
count to catch the `== 0` trigger; batch my status flips so they don't race JM's live triage writes.

## The five rules
1. **LOG FIRST.** Every JM report → `FEEDBACK-LOG.md`, numbered, *before* touching code. Fixing
   without logging = the report gets lost. Never make JM re-report.
2. **`🔨 built ≠ done`. The MOMENT I finish working an item (shipped to QA), I FLIP its in-app backlog
   status to `totest` — WITH the how-to-test (JM directive 2026-07-09).** That `totest` list IS JM's
   testing queue: "once you've worked an item, place it under to test so I have a list of what to test and
   how to test." So every worked item → status `totest` in the SHARED backlog (`/auth/admin/backlog/:n` or the
   shared file), and its FEEDBACK-LOG.md entry carries a **`Verify:`** clause (build-backlog surfaces it as the
   app's "What to test"). Never leave a shipped item at `todo`/`🔨` — that hides it from JM's to-test list.
   Only **JM** flips `totest → pass` (Tested ✓) after testing on QA. **JM marking `pass` IS his promote
   sign-off (JM 2026-07-09): the moment items are `pass`, I PROMOTE them to prod and flip `pass → done`** —
   don't sit on tested-green work. (`done` = shipped to prod + signed off.) I never self-certify UX.
   And a `fail` → I rework it immediately (bugs are highest priority) and re-ship it back to `totest` when fixed
   (it stays `fail` while I work, preserving JM's signal, until it's ready to re-test).
3. **A test ships with every fix — DEFINE a real unit test, don't hand-wave (JM 2026-06-30: "I don't see
   you define proper unit tests").** The DEFAULT is a unit test; if the logic lives inside a component,
   **extract the pure function** to a plain module so it CAN be tested (e.g. `vo2max-submax.ts`, `mind-stats.ts`,
   `modules.ts`, `running-paces.ts`). Assert real values + edge cases, not just "it runs".
   - Pure logic → **unit test** in `src/<thing>.test.ts` (`npm test`, vitest). **Then add/extend the file in the
     🧮 UNIT TEST INVENTORY in FEEDBACK-LOG.md and bump the count** — that inventory is the logged proof.
   - API behaviour → a row in `scripts/smoke-test.mjs` (`npm run test:smoke`).
   - Pure UI/visual or a server side-effect with no pure fn → say so explicitly + a **manual step in the QA checklist**
     (don't pretend a unit test exists; don't skip silently).
   Write it, run it GREEN, commit it (test + fix + inventory/guide update together).
4. **Two living lists in `FEEDBACK-LOG.md` — keep BOTH current:** the **🧮 Unit test inventory** (every test file →
   what it proves → count) and the **🧪 Test guide / QA checklist** (per item: manual steps + expected + status
   ❌→🔧→🧪→✅). Update them in the SAME commit as the fix. Only JM flips 🧪→✅.
5. **Verify against reality, not the compiler:** trace what the button/flow actually does; check the
   **source of truth** (do these feedback choices match intervals? does this gate fire on desktop?).
   Mock-first for anything JM sees (`options-first`).

## How to run the net
- `npm test` — unit (vitest, `src/*.test.ts`). First added 2026-06-26 (`src/zones.test.ts`).
- `npm run test:smoke` — API integration against the dev API (`scripts/smoke-test.mjs`).
- The **🧪 Test guide section of `FEEDBACK-LOG.md`** / `TESTING.md` — the manual rows JM eyeballs per gate.

## The loop for each item
log it → write a failing test that captures the bug → fix until green → commit (test + fix + the
🧪 Test guide row in FEEDBACK-LOG.md) → ship to QA → **FLIP its backlog status to `totest` + write the how-to-test
(`Verify:`)** → hand JM the manual step → JM verifies on QA → JM marks `pass` → I flip `pass → done` on promote.
One at a time. The `totest` status is not optional bookkeeping — it's how JM gets his "what/how to test" list.

Pairs with `options-first` (mock UX first), `feedback-log-discipline`, `platyplus-ops`.
