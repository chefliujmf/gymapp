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

## The ONE-BY-ONE pipeline (JM 2026-07-10/11 — SUPERSEDES the old 10-at-a-time batch) — how we drive to ZERO
Work **ONE item at a time**, NOT a batch of 10. Keep only a small rolling `totest` buffer (cap ~5). Per item:
1. **Build it → flip its status to `totest` (🧪)** in FEEDBACK-LOG + write the how-to-test (rule 2). This is the
   handoff. ⚠️ It must be **🧪**, never 🔨 — see the emoji mapping in rule 2.
2. **JM tests on QA** (a `dev` push auto-deploys to QA/staging). **NOT on prod** — `dev` IS the QA env. (Coach-only
   bits that only run on prod, e.g. daily-adapt #439, are the rare exception JM tests on prod — but the DEFAULT is QA.)
3. **JM flips `pass` (Tested ✓) or `fail` (✗)** in his live triage.
   - **`pass` ⇒ PROMOTE THAT ITEM ALONE** with `scripts/promote-item.sh <N>` (cherry-picks its commit onto a branch
     off `main` → prod PR → CI build-gates auto-merge → `deploy.yml` ships prod), then mark **`done`**. **NEVER
     promote wholesale dev→prod** — dev carries untested worker fixes + infra that must not ride along (JM directive).
   - **`fail` ⇒ rework immediately** (a bug I own — top priority); it stays `fail` (preserving JM's signal) until
     fixed, then back to `totest`.
- **Pick order (JM 2026-07-11, EXACT):** PRIORITY first (HIGH>MED>LOW), then **Tested-Failed before Bugs** within
  each priority, then **OLDEST # first**. **ALL bugs before ANY feature/idea.** The **order mindset stays even when
  polishing HERE in chat**, not just the worker — no ad-hoc cherry-picking.
- **ASSESS RELEVANCE on every item** (JM 2026-07-09): old items referencing a removed/redesigned feature →
  `discarded` (don't work it). Reconcile already-fixed-but-stale `todo` bugs (verify the `#NNN` code ref + test →
  `totest`), don't re-fix. Batch my status flips so they don't race JM's live triage writes.
- **The XPS worker is PARKED (JM 2026-07-11):** bugs normally run on the autonomous XPS worker (see memory
  `platyplus-bug-worker-architecture`), but JM paused it — **THIS chat works the whole queue** (bugs included) until
  the app is polished, then automation resumes. Don't rely on the #468 watcher/trigger while parked.

## The five rules
1. **LOG FIRST.** Every JM report → `FEEDBACK-LOG.md`, numbered, *before* touching code. Fixing
   without logging = the report gets lost. Never make JM re-report.
2. **`built ≠ done`. The MOMENT I finish an item (shipped to QA), I flip its FEEDBACK-LOG status to `🧪` (To test)
   + write the how-to-test.** ⚠️ **THE TRIAGE IS THE BOARD, NOT THE .md — this is what I got wrong (JM caught it
   2026-07-11, To-test bucket read 0 for hours).** JM's app computes each item's status as **`triage[n].status ?? .md-derived`**
   — so the shared **triage OVERRIDES** the FEEDBACK-LOG status. Flipping the `.md` emoji only shows for the ~170 items JM
   has NEVER triaged; **most built items already carry a triage entry** (often a stale `done`/`todo` — e.g. a REOPENED item
   like #145 kept its old `done`), which SILENTLY HIDES my `🧪`. So to actually hand JM an item to test, **SET ITS TRIAGE
   STATUS to `totest`** — via `PUT /auth/admin/backlog/:n {status:'totest'}` (admin) OR a safe atomic write to the shared
   `/srv/backlog/backlog.json` on the box (`readBacklog` reads fresh, so it sticks; batch flips to avoid racing JM's live
   edits). The `.md` still gets `🧪` + a **`Verify:`** how-to-test clause (that text is the app's "What to test"), and
   `build-backlog.mjs` maps `🧪→totest · ✅→done · ✗→fail · 🔨/⬜→todo` — but the TRIAGE is what determines JM's bucket.
   **Do it on EVERY item you finish, immediately — not batched later.** Only **JM** flips `totest → pass` after testing
   **on QA**. **`pass` = his promote sign-off: promote THAT item alone (`scripts/promote-item.sh <N>`) → set triage `done`**
   — never sit on green work, never promote wholesale. A `fail` → rework immediately; re-ship by setting triage back to
   `totest`. I never self-certify UX.
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
