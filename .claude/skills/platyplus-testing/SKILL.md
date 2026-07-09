---
name: platyplus-testing
description: Test + verification discipline for Platyplus — log every report first, write a test with every fix, "built ≠ done" (only JM marks ✅), keep the 🧪 Test guide section of FEEDBACK-LOG.md current. Use on EVERY bug fix or feature, before claiming anything works.
---

# Test & verify (Platyplus) — earn the ✅

**Why this exists (JM, 2026-06-26):** I shipped a pile of "built" code that didn't work and
didn't log JM's reports, so they got lost and he had to repeat them. Trust broke. This is how
it doesn't happen again.

## The five rules
1. **LOG FIRST.** Every JM report → `FEEDBACK-LOG.md`, numbered, *before* touching code. Fixing
   without logging = the report gets lost. Never make JM re-report.
2. **`🔨 built ≠ done`. The MOMENT I finish working an item (shipped to QA), I FLIP its in-app backlog
   status to `totest` — WITH the how-to-test (JM directive 2026-07-09).** That `totest` list IS JM's
   testing queue: "once you've worked an item, place it under to test so I have a list of what to test and
   how to test." So every worked item → status `totest` in the SHARED backlog (`/auth/admin/backlog/:n` or the
   shared file), and its FEEDBACK-LOG.md entry carries a **`Verify:`** clause (build-backlog surfaces it as the
   app's "What to test"). Never leave a shipped item at `todo`/`🔨` — that hides it from JM's to-test list.
   Only **JM** flips `totest → pass` (Tested ✓) after testing on QA; I flip `pass → done` on prod promote.
   I never self-certify UX.
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
