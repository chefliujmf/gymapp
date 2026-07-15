---
name: verify-before-ready
description: Before telling JM anything is "ready / fixed / done", VERIFY it against real data on the deployed env, AND update the shared backlog immediately — in the RIGHT store (the /srv/backlog file, never app_meta), then confirm the write landed. Use at the end of every fix, before reporting.
---

# Verify before "ready" — and log the fix immediately

**Why this exists (JM, 2026-07-14, twice in one session):** (1) I kept saying "ready to test / fixed"
without actually verifying, and (2) I wrote every backlog status update to `app_meta` — a DEAD store the
app ignores — so JM saw NOTHING change and couldn't find fixes to test. A whole session of "updates" that
never landed. Both break trust. This is the checklist that stops it.

## RULE 1 — "ready" is a claim you EARN, never a default

Do NOT tell JM something is ready / fixed / done / working until you have **watched it work**:
- **Real data, deployed env.** Not "it compiles", not a mock, not "the unit test passes". Exercise the ACTUAL
  path on the deployed target with the real athlete's data (e.g. curl the live endpoint, query the real store,
  render with i28814's real numbers). Mocks lie; real data has the glitches.
- **The full round-trip, in the store the app actually uses.** A value "saved" means you READ IT BACK from the
  real store and saw it. A UI fix means the served bundle contains it AND the value the client receives matches
  what it checks (verify the end-to-end CONTRACT — the #512 `source: 'race VDOT (…)'` vs `=== 'race VDOT'`
  mismatch silently disabled a whole feature even though the server was right).
- **Every entry point / persona.** Runner-only vs gym-only, QA vs prod, fresh browser vs cached.
- If you did NOT verify it, SAY SO plainly ("built, not yet verified — needs a test on QA"). `built ≠ done`;
  only JM marks the final ✅. Never dress up unverified work as done.

## RULE 2 — update the backlog the INSTANT a fix ships (in the RIGHT store)

The moment you fix an item, mark it — before moving on, before reporting:

- **The backlog is ONE shared file: `/srv/backlog/backlog.json`**, bind-mounted into BOTH prod and QA from the
  host `/home/jmf/backlog-shared`. It is ONE backlog for ALL environments (JM: prod + QA are NEVER separate).
  The SAME report has the SAME number everywhere.
- **NEVER `app_meta.backlog`.** That Postgres field is a dead legacy store the app does not read or write.
  Touching it does nothing (this is the exact bug that cost the 2026-07-14 session).
- **READ** via `GET /auth/admin/backlog` (API, reads the file) or on the box `ssh xps 'docker exec gymapp cat
  /srv/backlog/backlog.json'`.
- **WRITE** via `PUT /auth/admin/backlog/:n` (admin API) or edit `/srv/backlog/backlog.json` on the box
  (read-modify-write the `{triage, added}` JSON). Set the status: `totest` when built + on QA, `done` only on
  JM's sign-off, `fail` if he re-opened it, `discarded` if stale.
- **VERIFY the write landed** — read it back and confirm the status/comment is there. A backlog update you didn't
  read back is a backlog update that might have gone to the void.
- Add a short `comments` note (`{text, at, by:'claude'}`) saying what changed + how to test.

## The 30-second close-out (run before every "here's what I did")

1. Did I VERIFY it on the deployed env with real data (not just build/test-green)? → if no, say "unverified".
2. Did I update `/srv/backlog/backlog.json` for every item I touched, and READ IT BACK to confirm?
3. Is my status honest? (`totest` = you test it; `done` = JM already signed off; never invent ✅.)
4. Does the report tell JM the exact steps to verify + which env?

Pairs with skill `platyplus-testing` (the broader test discipline + priority order) and memories
`platyplus-admin-backlog`, `definition-of-done-validate`. The store lesson also lives in CLAUDE.md's
"CURRENT WORK QUEUE" section.
