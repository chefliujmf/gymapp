# Platyplus — regression test list

A **living** checklist. When a feature lands, add its cases here so future changes can be
re-tested the same way. Two promotion **gates**, matching the 3-env flow (see DEPLOY.md):

- **Gate 1 — Dev → QA** (minimum functional pass): the developer runs this locally before
  pushing to `dev` (which auto-deploys QA). Fast; mostly automatable.
- **Gate 2 — QA → Prod** (full acceptance, classic-IT style): run on **QA**
  (`platyplus-qa.duckdns.org`) before opening the PR `dev`→`main` that auto-deploys prod.
  Covers the things only a real deployment exercises (NPM/TLS, real OAuth, passkeys bound to
  the domain, streaming through the proxy).

Legend: **[A]** automated (`npm run test:smoke`) · **[M]** manual.

---

## Gate 1 — Dev → QA (minimum pass)

Run `npm run dev:full`, then `npm run test:smoke`, then eyeball the manual rows.

| # | Area | Check | Expected | A/M |
|---|------|-------|----------|-----|
| 1 | Build | `npm run build` | exits 0, no TS errors | [A] |
| 2 | API up | `GET /auth/config` | 200 | [A] |
| 3 | Auth | login (jmfiset/devpass) | 200 + session cookie | [A] |
| 4 | Account | `GET /auth/me` | has `coachName`, `hasCoachProfile` fields | [A] |
| 5 | Athlete | `GET /auth/profile/athlete` | 200, `{profile, updatedAt}` | [A] |
| 6 | Athlete | `PUT` then `GET` roundtrip | saved text comes back | [A] |
| 7 | Coach name | `PUT /auth/profile {coachName}` → `me` | name persists | [A] |
| 8 | Chat | `POST /auth/chat` first SSE frame | `{coach:…}` arrives immediately | [A] |
| 9 | Profile UI | Profile → Athlete shows profile, Edit→Save sticks | renders + persists on reload | [M] |
| 10 | Coach name UI | type a name, tap away | "Saved ✓" shows; sticks on reload | [M] |
| 11 | Chat UI | send a message | streams token-by-token (not all at once) | [M] |
| 12 | Coach knows you | "summarize my objectives" | answers from your profile (not "set a goal") | [M] |

## Gate 2 — QA → Prod (full acceptance)

Everything in Gate 1 **on QA**, plus:

| # | Area | Check | Expected | A/M |
|---|------|-------|----------|-----|
| 20 | TLS/NPM | site loads over https, valid cert | no warning | [M] |
| 21 | Streaming | coach reply through NPM | streams progressively (X-Accel-Buffering works) | [M] |
| 22 | Coach engine | "plan my week per your method" | applies method: key session + checks HRV/Form/eFTP/availability | [M] |
| 23 | App-help | "how do I connect Strava?" | gives the in-app steps | [M] |
| 24 | Passkey | register + sign in with passkey | works (bound to the prod/QA domain) | [M] |
| 25 | intervals.icu | paste key → calendar populates | planned/done rides show; ATP/targets filtered; rides deduped | [M] |
| 26 | Strava | Connect → activities show; Disconnect | OAuth round-trip ok | [M] |
| 27 | Media independence | spot-check exercise/recipe media | served from `/media/*`, no 3rd-party URLs | [M] |
| 28 | Health | `docker ps` status | `healthy`; no error spikes in `docker logs` | [M] |
| 29 | No regressions | Today, Train (gym/ride/run), Eat, Mind, Progress | all load, no console errors | [M] |

---

## Feature: intervals.icu two-way mirror (needs a live intervals account)
Add to **Gate 2 (QA→Prod)** — these touch real calendar data:

| # | Check | Expected |
|---|-------|----------|
| 40 | Create a planned ride in Platyplus | appears in intervals.icu (mirror), linked |
| 41 | Edit it in Platyplus | intervals updates (Platyplus wins) |
| 42 | Create a workout directly in intervals.icu, reload Today | it imports + shows ONCE (no duplicate card) |
| 43 | Delete that intervals-origin workout in intervals, reload | it disappears from Platyplus (drop-to-mirror) |
| 44 | Delete a Platyplus-origin plan in Platyplus | gone from both; intervals event removed |
| 45 | A coach (cyclingcoach) dual-written session | shows once as an owned plan, no dupe |

## Backlog of cases to add as features land
- New-user onboarding Q&A (text + audio STT) → profile created
- intervals-plan MCP tool → coach cites real upcoming sessions
- Chat on prod (host helper → 8088)
- Anti-scrape signed/expiring media URLs
