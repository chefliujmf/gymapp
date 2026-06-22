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

## Feature: navigation hubs + multi-sport (Gate 1, [M])
| # | Check | Expected |
|---|-------|----------|
| 50 | Bottom nav | 5 tabs: Today · Plan · Train · Stats · More |
| 51 | Profile → Sports = only Cycling (save) | Stats shows Fitness + Progress (no Strength); Train leads with Ride |
| 52 | Sports = only Strength | Stats shows Strength + Progress (no Fitness); Train leads with Gym |
| 53 | Sports = Cycling + Strength | Stats shows Fitness + Strength + Progress |
| 54 | Account dropdown | Profile · Settings · (Admin) · Coach API · Log out |

## Feature: analytics / charts (Gate 1 [M], needs intervals for Fitness)
| # | Check | Expected |
|---|-------|----------|
| 60 | Fitness page: scrub a line/bar chart | headline/value tracks the finger; mini-cards update their number (no tooltip box) |
| 61 | Axes | y shows 5 round-number ticks; x shows dates; date filter presets + Custom from/to |
| 62 | Form chart | green "optimal" zone band (−10…−30) + coach insight line |
| 63 | ⓘ on a metric | tap reveals a short explanation; tap away dismisses |
| 64 | Expand (⤢) a chart | opens larger in a modal; tap outside closes |

## Feature: Strength loop (Gate 1 [A]+[M]) — `npm run test:smoke` will cover e1RM math
| # | Check | Expected |
|---|-------|----------|
| 70 | Log a gym set (e.g. 80kg×10) → Strength page | exercise shows an e1RM trend |
| 71 | Start a workout prescribing N reps for that exercise | gym player pre-fills a suggested WEIGHT from your e1RM |
| 72 | Set list while logging | each logged set shows its live 1RM |
| 73 | /logs (History) | past sessions list with sets + Best 1RM; edit a weight/rep → it saves (device + account) |

## Backlog of cases to add as features land
- New-user onboarding Q&A (text + audio STT) → profile created
- Daily check-in (sleep/soreness/energy) → coach reads it
- PR celebration when you beat your 3-month 1RM
- Chat on prod (host helper → 8088)
- Anti-scrape signed/expiring media URLs
