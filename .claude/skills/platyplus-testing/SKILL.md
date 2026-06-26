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
2. **`🔨 built ≠ done`.** tsc/build/deploy green is NOT verified. Mark a fix **🧪 (fixed+test,
   awaiting JM)**. Only **JM** flips it to **✅** after testing on QA. I never self-certify UX.
3. **A test ships with every fix:**
   - Pure logic → a **unit test** in `src/<thing>.test.ts` (`npm test`, vitest). Extract the logic
     to a plain module (e.g. `src/zones.ts`) so it tests without React.
   - API behaviour → a row in `scripts/smoke-test.mjs` (`npm run test:smoke`).
   - UI flow / visual → a **manual step in the 🧪 Test guide section of `FEEDBACK-LOG.md`** (steps + expected). 
   Write it, run it GREEN, commit it. The test is the permanent regression net.
4. **The 🧪 Test guide section of `FEEDBACK-LOG.md` is the one-by-one guide** JM works through: per item =
   unit-test file + manual steps + expected + status (❌ → 🔧 → 🧪 → ✅). Keep it current; archive ✅ items out of the active log.
5. **Verify against reality, not the compiler:** trace what the button/flow actually does; check the
   **source of truth** (do these feedback choices match intervals? does this gate fire on desktop?).
   Mock-first for anything JM sees (`options-first`).

## How to run the net
- `npm test` — unit (vitest, `src/*.test.ts`). First added 2026-06-26 (`src/zones.test.ts`).
- `npm run test:smoke` — API integration against the dev API (`scripts/smoke-test.mjs`).
- The **🧪 Test guide section of `FEEDBACK-LOG.md`** / `TESTING.md` — the manual rows JM eyeballs per gate.

## The loop for each item
log it → write a failing test that captures the bug → fix until green → commit (test + fix + the
🧪 Test guide row in FEEDBACK-LOG.md) → hand JM the manual step → JM verifies on QA → JM marks ✅. One at a time.

Pairs with `options-first` (mock UX first), `feedback-log-discipline`, `platyplus-ops`.
