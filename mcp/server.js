#!/usr/bin/env node
// Platyplus MCP server.
//
// Lets an AI coach (cyclingcoach, bertfitnesscoach, the in-app assistant) create
// training & nutrition for a Platyplus account through TYPED tools, instead of
// writing fragile free-text into an intervals.icu description. Each tool calls the
// Platyplus Coach REST API (Bearer token); the app stores it canonically and mirrors
// workouts to intervals.icu in the one format the app parses reliably.
//
// Config (env):
//   PLATYPLUS_URL    base URL, e.g. https://platyplus.duckdns.org   (default)
//   PLATYPLUS_TOKEN  the account's Coach API token (Profile -> Coach API)  [required]
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { validateGymWorkout } from './gym-guard.js'

const BASE = (process.env.PLATYPLUS_URL || 'https://platyplus.duckdns.org').replace(/\/$/, '')
const TOKEN = process.env.PLATYPLUS_TOKEN
if (!TOKEN) { console.error('platyplus-mcp: set PLATYPLUS_TOKEN (the account Coach API token)'); process.exit(1) }

const newId = () => 'mcp-' + Math.random().toString(36).slice(2, 10)

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const txt = await res.text()
  let data; try { data = txt ? JSON.parse(txt) : null } catch { data = txt }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  return data
}
const ok = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] })
const wrap = (fn) => async (a) => { try { return ok(await fn(a)) } catch (e) { return { content: [{ type: 'text', text: 'ERROR: ' + (e?.message || e) }], isError: true } } }

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD')
const server = new McpServer({ name: 'platyplus', version: '1.0.0' })

// --- discovery ------------------------------------------------------------
server.tool('search_exercises',
  'Search the Platyplus exercise library by name; returns ids (exId), the equipment tag, and demo media. Use the exId in create_workout. Every result is a COMPLETE exercise with a real VIDEO demo (image-only entries are never returned) — so always pick from these and never invent an exId. Results are ranked best-match first, so the TOP hit is usually the right movement. IMPORTANT: pass `equipment` = the athlete\'s OWNED gear (see the profile) so you only ever prescribe exercises they can actually do; "Bodyweight" needs nothing.',
  { query: z.string().describe('name fragment, e.g. "goblet squat"'), equipment: z.string().optional().describe('comma-separated owned equipment to limit to, e.g. "Dumbbell,Bodyweight,Bands"'), limit: z.number().int().min(1).max(100).optional() },
  wrap((a) => api('GET', `/api/exercises?q=${encodeURIComponent(a.query)}&equipment=${encodeURIComponent(a.equipment || '')}&limit=${a.limit || 20}`)))

server.tool('search_recipes',
  "[DEACTIVATED right now — Eat & Mind are OFF; do NOT use for planning, the server rejects meal items.] Search the Platyplus recipe library to PICK a real meal for fueling; returns ids + macros (kcal, protein) + each recipe's `diet`. Results are ALREADY filtered to the athlete's dietary preference (vegetarian → veg+vegan only, vegan → vegan only), so every result is safe to suggest — never recommend a meal outside what's returned. Use the id as recipeId in schedule_meal. Filter by category and/or a name/tag query. (Pick however many meals/snacks the day warrants — variable, not fixed.)",
  { query: z.string().optional().describe('name or tag fragment'), category: z.string().optional().describe('breakfast | lunch | dinner | snack'), limit: z.number().int().min(1).max(100).optional() },
  wrap((a) => api('GET', `/api/recipes?q=${encodeURIComponent(a.query || '')}&category=${encodeURIComponent(a.category || '')}&limit=${a.limit || 20}`)))

server.tool('search_sessions',
  '[DEACTIVATED right now — Eat & Mind are OFF; do NOT use for planning, the server rejects mind items.] Search the Platyplus mind/movement library (meditation, yoga, pilates, breathing) to PICK a real session/class; returns ids + duration. Use the id as refId in schedule_mind. Filter by kind and/or a query. For a yoga/pilates day you SELECT a class here (you do not author poses).',
  { query: z.string().optional(), kind: z.string().optional().describe('meditation | yoga | pilates | breathing'), limit: z.number().int().min(1).max(100).optional() },
  wrap((a) => api('GET', `/api/sessions?q=${encodeURIComponent(a.query || '')}&kind=${encodeURIComponent(a.kind || '')}&limit=${a.limit || 20}`)))

server.tool('list_schedule',
  'List everything planned for an account between two dates: workouts/rides/runs (plans) and meals/mind/notes (items).',
  { from: DATE, to: DATE },
  wrap(async (a) => {
    const [plans, items] = await Promise.all([
      api('GET', `/api/plans?from=${a.from}&to=${a.to}`),
      api('GET', `/api/items?from=${a.from}&to=${a.to}`),
    ])
    return { plans, items }
  }))

// --- intervals.icu read-through (analytics live there, not in Platyplus) ----
server.tool('get_wellness',
  "Read the athlete's recent intervals.icu wellness: Fitness (CTL), Fatigue (ATL), Form (CTL-ATL), resting HR, HRV, sleep hours/score, body weight. READ-ONLY and live from intervals.icu — returns { connected:false } if they haven't connected it, in which case adapt with what you have. Check this before changing load when recovery state matters.",
  { days: z.number().int().min(1).max(60).optional().describe('lookback days; default 14') },
  wrap((a) => api('GET', `/api/intervals/wellness?days=${a.days || 14}`)))

// #404 — the athlete's COMPUTED performance profile, so you coach from their ACTUAL numbers, not just theory.
server.tool('get_metrics',
  "Read the athlete's computed performance PROFILE (live from intervals.icu, READ-ONLY). Per sport — cycling: FTP · eFTP · Critical Power (CP) · W' (anaerobic reserve, kJ) · TTE (time-to-exhaustion at FTP, s) · Efficiency Factor; running: threshold pace · Critical Speed (CS) · D' (m) · TTE · EF — plus a synthesised athlete TYPE (Punchy-threshold / Diesel / All-rounder / Puncheur) with a training focus. ALL model-derived from their power/pace curve — NO exhaustion or lab test needed; normal hard efforts sharpen it. Use this to coach BEYOND one FTP number: read the PROFILE — short TTE (≪30 min vs eFTP) ⇒ extensive threshold (3×15–20 min @ 90–95%) and/or ease FTP toward eFTP; small W'/D' ⇒ short near-max repeats; rising EF ⇒ the aerobic base is working, keep it. Returns { connected:false } if intervals isn't connected. Theory: docs/beyond-ftp-metrics.md + docs/tte.md.",
  {},
  wrap(() => api('GET', '/api/athlete-metrics')))

server.tool('get_weather',
  "Get the day's WEATHER forecast + coaching guidance for the athlete's location (free, no key). Call it before planning or confirming an OUTDOOR run/ride, especially in heat/cold. Returns feels-like temp, wind, rain%, and ready-made guidance (heat derating, hydration, cold layers, wind, or move-indoors). { needsLocation:true } means no location yet — ask the athlete their city (it also auto-fills from their next GPS activity). Use it to ADJUST intensity/pace + add fuel/hydration notes, don't just report it. NEVER put the weather in a workout's TITLE or description (no \"Rain Day\", \"Hot Day\", \"Windy…\"): title + describe every session by its TRAINING content and purpose (\"Full-Body Strength\", \"Sweet-Spot 3×12\"); weather only informs whether it's indoor/outdoor, the intensity, and fuel/hydration — it is never the name or theme.",
  { date: DATE.optional().describe('YYYY-MM-DD; default today. Use the planned session date.') },
  wrap((a) => api('GET', `/api/weather${a.date ? `?date=${a.date}` : ''}`)))

server.tool('get_recent_activities',
  "Read the athlete's recently COMPLETED activities from intervals.icu: each has `id` (the activity id — pass it to save_coach_review / set_activity_text to review or annotate THAT activity), date, type, indoor/outdoor, duration, distance, avg HR, avg power, Load (TSS), intensity (IF), RPE, feel, and `reviewed` (true once you've reviewed it — this is the reviewed/NOT-reviewed tracker; `reviewed:false` means it's still waiting for your review). READ-ONLY; returns { connected:false } if intervals.icu isn't connected.",
  { days: z.number().int().min(1).max(60).optional().describe('lookback days; default 14') },
  wrap((a) => api('GET', `/api/intervals/activities?days=${a.days || 14}`)))

server.tool('get_checkins',
  "Read the athlete's recent daily check-ins (how they FELT): all 1–5: energy (5=energized), sleep (5=fully rested), soreness (5=very sore), optional note. This is the signal to adapt to when intervals.icu isn't connected — heavy legs / poor sleep / high soreness ⇒ ease off.",
  { days: z.number().int().min(1).max(60).optional().describe('lookback days; default 14') },
  wrap((a) => { const to = new Date().toISOString().slice(0, 10); const from = new Date(Date.now() - (a.days || 14) * 86400000).toISOString().slice(0, 10); return api('GET', `/api/checkins?from=${from}&to=${to}`) }))

server.tool('set_athlete_profile',
  "Save/replace the athlete's coaching profile (markdown: goals, sport(s), weekly hours, FTP/maxes, equipment, constraints, injuries, preferences). Use this to PERSIST what you learn when onboarding a new athlete or when they tell you something durable — this is the profile you read every session. Write the FULL updated profile, not a fragment.",
  { profile: z.string().describe('the full athlete profile as markdown') },
  wrap((a) => api('PUT', '/api/profile/athlete', { profile: a.profile })))

server.tool('check_connections',
  "Check what's connected + whether the athlete's data is actually flowing into intervals.icu. Returns: intervals linked?, Strava linked?, how many activities synced in the last 3 weeks (+ the latest one's date/type/source device), which device sources are feeding intervals (e.g. Garmin/Coros/Wahoo/Strava), and whether HRV/sleep/resting-HR wellness is present. Use during onboarding (and anytime data looks missing) to tell the athlete EXACTLY what to connect — e.g. if they said they use a Coros but no activities are syncing, tell them to connect Coros inside intervals.icu.",
  {},
  wrap(() => api('GET', '/api/connections')))

server.tool('save_coach_memory',
  "Save/replace YOUR durable coaching memory for this athlete — what you've learned WORKS or FAILS for them, adjustments that paid off, and how they like to be coached (tone, cadence, preferences, constraints). Separate from set_athlete_profile (that's WHO they are; this is HOW to coach them). Read it every session and keep it current: write the FULL updated memory as tight dated bullets, marking rules active/retired. Use when they give feedback, when an approach works/flops, or when they state a preference.",
  { memory: z.string().describe('the full coach memory as markdown (dated bullets, active/retired)') },
  wrap((a) => api('PUT', '/api/coach-memory', { memory: a.memory })))

server.tool('set_sports',
  'Set the athlete\'s sports (drives the app navigation + which coaching modules apply). Allowed: cycling, running, strength, yoga, pilates. (Meditation is deactivated along with Mind — #491; do not set it.)',
  { sports: z.array(z.string()).describe('e.g. ["cycling","strength"]') },
  wrap((a) => api('PUT', '/api/profile', { sports: a.sports })))

// #313 — SAVE the athlete's threshold stats. CRUCIAL for runs/rides: without a threshold pace / FTP
// set, %pace / %ftp workout targets have nothing to resolve against on their watch. If a value is
// missing, ESTIMATE it from get_recent_activities / get_wellness (recent hard efforts, eFTP, best
// 20-min power, threshold runs) and set it here, then TELL the athlete your estimate + that it'll refine.
server.tool('set_thresholds',
  'Save the athlete\'s threshold benchmarks so workout targets resolve on their device + Platyplus. Mirrors to intervals.icu. Set what you know/estimated; omit the rest. thresholdPace is running seconds-per-km (e.g. 300 = 5:00/km).',
  { group: z.enum(['cycling', 'running']).describe('which sport these belong to'),
    ftp: z.number().optional().describe('cycling FTP in watts'),
    thresholdPace: z.number().optional().describe('running threshold pace, SECONDS per km (e.g. 5:00/km = 300)'),
    maxHr: z.number().optional().describe('max heart rate, bpm'),
    lthr: z.number().optional().describe('lactate-threshold HR, bpm') },
  wrap((a) => api('PUT', '/api/sport-stat', { group: a.group, ftp: a.ftp, thresholdPace: a.thresholdPace, maxHr: a.maxHr, lthr: a.lthr })))

// --- training -------------------------------------------------------------
// Structured coaching the app renders as the plan SHELL (Platyplus is master; this
// also mirrors into the intervals description). The meals/sessions themselves are
// SEPARATE items (schedule_meal/schedule_mind, each with a per-pick `why`); fuel.why
// and mind.why here are the STRATEGY, not the picks.
const COACHING = {
  objective: z.string().optional().describe('one-line goal of the session'),
  cues: z.array(z.string()).optional().describe('short in-session cues'),
  tip: z.string().optional().describe('one WHOLE-SESSION tip shown as a banner (e.g. "control the tempo — slow lowering builds strength; keep rests ~90-120s on the big lifts")'),
  success: z.string().optional().describe('what "done well" looks like'),
  recovery: z.string().optional().describe('post / evening / next-AM recovery guidance'),
  fuel: z.object({ why: z.string().optional().describe('Pre/During/Post fueling strategy'), supplements: z.string().optional() }).optional(),
  mind: z.object({ why: z.string().optional().describe('mental-focus theme') }).optional(),
}
const coachingOf = (a) => ({ objective: a.objective, cues: a.cues, tip: a.tip, success: a.success, recovery: a.recovery, fuel: a.fuel, mind: a.mind })
server.tool('create_workout',
  'Schedule a strength/gym workout on a date. Platyplus is the MASTER and mirrors to intervals.icu. Re-call with the same id to UPDATE. THREE HARD REQUIREMENTS (the tool REJECTS the plan otherwise, so build them in up front): (1) a WARM-UP and a COOL-DOWN, each broken into INDIVIDUAL moves — one entry per move, tagged section:"warmup"/"cooldown", every one with a real library exId from search_exercises (arm circles, leg swings, high knees, cat-cow, jogging in place, glute bridge, targeted stretches…); NEVER cram moves into one "Warm-up: A, B, C" line. (2) Order the MAIN set by equipment (barbell → dumbbell → cable/machine → bodyweight/trunk) so the athlete isn\'t ping-ponging stations. (3) Every single-side move (Pallof press, split squat/Bulgarian, single-arm/leg, side plank, suitcase carry, Copenhagen…) MUST be prescribed both sides — set eachSide:true (renders "each side") or write explicit left/right entries. Optionally attach the coaching shell (objective/cues/success/recovery/fuel/mind strategy). ONE SESSION/DAY: the app REJECTS (409) a 2nd session on a day already at the athlete\'s max, AND any session that would exceed their HARD weekly training-days cap (move or combine, do NOT add a new day past the cap) — re-call with that day\'s existing id to fold moves in, or move it to a free day. Gym EXERCISES live + render in Platyplus (intervals has no gym model — it only gets a deep-link) — ALWAYS send the full structured exercises here; to UPDATE a gym session, re-call with its SAME id (never leave a gym session with no exercises).',
  {
    date: DATE,
    title: z.string(),
    rounds: z.number().int().positive().optional().describe('circuit rounds; default 1'),
    exercises: z.array(z.object({
      name: z.string(),
      exId: z.string().optional().describe('catalog id from search_exercises (links the demo)'),
      section: z.enum(['warmup', 'main', 'cooldown']).optional().describe("which part of the session; default 'main'. Tag each warm-up/cool-down move so they render under their own header — do NOT combine moves into one line."),
      mode: z.enum(['reps', 'timed']).optional().describe("default 'reps'"),
      sets: z.number().int().optional(),
      reps: z.number().int().optional(),
      weight: z.number().optional().describe('kg (optional; the app auto-fills from e1RM if omitted)'),
      seconds: z.number().int().optional().describe('work seconds for timed mode'),
      rest: z.number().int().optional().describe('rest seconds (optional)'),
      eachSide: z.boolean().optional().describe('true for a single-side move (Pallof, split squat, single-arm/leg…) — the dose is PER SIDE and renders "each side" (L + R). REQUIRED on unilateral moves or the plan is rejected.'),
      tempo: z.string().optional().describe('lifting TEMPO / time-under-tension as 4 digits eccentric-pauseBottom-concentric-pauseTop, e.g. "3-1-1-0" = 3s lower, 1s pause, 1s lift, 0s top. Prescribe a slower eccentric (3-4s) for hypertrophy/control, faster for power. Omit if not relevant.'),
      tip: z.string().optional().describe('one short FORM cue for THIS lift, e.g. "brace hard, drive mid-foot, no bounce out of the hole"'),
    })).min(1).describe('ordered list of exercises (warm-up first, then the equipment-grouped main set, then cool-down)'),
    notes: z.string().optional(),
    ...COACHING,
    id: z.string().optional().describe('omit to create (a new id is returned); pass it back to update'),
  },
  wrap((a) => {
    // #168 — hard gate: warm-up + cool-down present, unilateral moves both sides. Reject (don't
    // silently fix) so the coach re-authors — teaching it in-session to build the right structure.
    const bad = validateGymWorkout(a.exercises)
    if (bad) throw new Error(bad)
    return api('POST', '/api/plan', {
      id: a.id || newId(), date: a.date, sport: 'gym', title: a.title,
      rounds: a.rounds || 1, exercises: a.exercises, notes: a.notes || '', ...coachingOf(a),
    })
  }))

const SEGMENTS = z.array(z.object({
  minutes: z.number().positive(),
  powerStart: z.number().describe('Intensity as % of threshold effort — % of FTP (ride) or threshold pace (run). Daniels zones (same scale both sports): recovery 30-40 · easy/aerobic/warm-up/cool-down 50-65 · marathon/steady 70-80 · threshold/tempo 90-100 · VO2/intervals 100-108 · reps/strides 108-120. 100 = threshold (~1 h race effort); easy is a low fraction of that (~80% of run volume lives there).'),
  powerEnd: z.number().optional().describe('% target at end of the segment; default = powerStart (steady)'),
  label: z.string().optional().describe('e.g. "Warm-up", "Easy jog", "Threshold", "Stride" — label matches the intensity (easy label ⇒ easy %)'),
})).min(1).describe('ordered segments (warm-up, work, recovery, cool-down, ...)')

const makeEndurance = (sport) => wrap((a) => api('POST', '/api/plan', {
  id: a.id || newId(), date: a.date, sport, title: a.title, ftp: a.ftp, notes: a.notes || '',
  segments: a.segments.map((s) => ({ duration: Math.round(s.minutes * 60), powerStart: s.powerStart, powerEnd: s.powerEnd ?? s.powerStart, label: s.label })),
  ...coachingOf(a),
}))

server.tool('create_ride',
  'Schedule a structured bike workout (power intervals). Platyplus is master; mirrors to intervals.icu as a real workout (steps → head unit/trainer). Re-call with same id to update. ONE SESSION/DAY: the app REJECTS (409) a 2nd session on a day already at the athlete\'s max, AND any session that would exceed their HARD weekly training-days cap (move or combine, do NOT add a new day past the cap) — never book two short rides; COMBINE into that day\'s existing session (re-call with its id) or move it to a free day. The app auto-computes the planned LOAD (TSS) from your segments and sends it to intervals so Form/CTL/ATL project correctly — you do NOT set load. Optionally attach the coaching shell (objective/cues/success/recovery/fuel/mind).',
  { date: DATE, title: z.string(), ftp: z.number().optional().describe('override FTP in watts'), segments: SEGMENTS, notes: z.string().optional(), ...COACHING, id: z.string().optional() },
  makeEndurance('ride'))

server.tool('create_run',
  'Schedule a structured run. Coach it the RUNNING way — Daniels E/M/T/I/R off threshold PACE (see SEGMENTS for the zones), not by bike power. The app converts each segment % to the athlete\'s real min/km. Re-call with same id to update. ONE SESSION/DAY: the app REJECTS (409) a 2nd session on a day already at the athlete\'s max, AND any session that would exceed their HARD weekly training-days cap (move or combine, do NOT add a new day past the cap) — COMBINE into that day\'s existing session (re-call with its id) or move it. The app auto-computes the planned LOAD (TSS) and sends it to intervals so Form projects — you do NOT set load. Optionally attach the coaching shell.',
  { date: DATE, title: z.string(), ftp: z.number().optional(), segments: SEGMENTS, notes: z.string().optional(), ...COACHING, id: z.string().optional() },
  makeEndurance('run'))

server.tool('remove_workout', 'Delete a scheduled workout/ride/run by id (also removes its intervals.icu mirror).',
  { id: z.string() }, wrap((a) => api('DELETE', `/api/plan/${encodeURIComponent(a.id)}`)))

// --- nutrition / mind / notes --------------------------------------------
server.tool('schedule_meal',
  '[DEACTIVATED right now — Eat & Mind are OFF (app simplified); the server rejects this, do NOT call it. Plan training + recovery only.] Put a meal on a day. PICK a real recipe via search_recipes and pass its id as recipeId so it links. `why` = your one-line reason for THIS pick (shown as "Coach\'s pick" on the recipe page). Schedule as many meals/snacks as the day needs.',
  { date: DATE, title: z.string(), recipeId: z.string().optional().describe('Platyplus recipe id from search_recipes'), mealType: z.string().optional().describe('breakfast | lunch | dinner | snack'), kcal: z.number().optional(), why: z.string().optional().describe('why this pick for this athlete/day'), id: z.string().optional() },
  wrap((a) => api('POST', '/api/items', { id: a.id, date: a.date, type: 'meal', title: a.title, refId: a.recipeId, mealType: a.mealType, kcal: a.kcal, why: a.why })))

server.tool('schedule_mind',
  '[DEACTIVATED right now — Eat & Mind are OFF (app simplified); the server rejects this, do NOT call it. Plan training + recovery only.] Put a mind/movement session (meditation, yoga, pilates, breathing) on a day. PICK a real session via search_sessions and pass its id as refId. `why` = your reason for THIS pick (shown as "Coach\'s pick" on the session page).',
  { date: DATE, title: z.string(), minutes: z.number().optional(), refId: z.string().optional().describe('Platyplus session id from search_sessions'), why: z.string().optional().describe('why this pick'), id: z.string().optional() },
  wrap((a) => api('POST', '/api/items', { id: a.id, date: a.date, type: 'mind', title: a.title, minutes: a.minutes, refId: a.refId, why: a.why })))

server.tool('schedule_recovery',
  'Put a RECOVERY block on a day (sauna, cold plunge, massage, mobility, foam roll, easy walk). It opens as its OWN activity view (like a workout), so give it STRUCTURE, NOT one text blob: `insight` = why THIS recovery today (the readiness reasoning — Form/HRV/soreness/fatigue in 1-2 plain sentences); `steps` = the routine as DISCRETE moves the athlete can follow one by one, each { name, dose (the amount, e.g. "60-90s/side", "2×30s", "2×8-10", "~10 min"), cue (optional one-line form tip) }; `sleep` = the day\'s sleep note. Shows in the 🛌 Recovery section → tap to open. (Do NOT dump everything into `why` — split it into insight + steps + sleep so it reads as an activity, not a wall of text.)',
  { date: DATE, title: z.string().describe('e.g. "Recovery + Mobility"'), kind: z.enum(['sauna', 'cold', 'massage', 'mobility', 'foam', 'walk']).optional(), minutes: z.number().optional(),
    insight: z.string().optional().describe('why THIS recovery today — the readiness reasoning, 1-2 sentences'),
    steps: z.array(z.object({ name: z.string(), dose: z.string().optional(), cue: z.string().optional() })).optional().describe('the routine as discrete moves, each with a dose (amount/time) + optional cue'),
    sleep: z.string().optional().describe("the day's sleep note, e.g. 'aim for ~9h'"),
    why: z.string().optional().describe('DEPRECATED free-text — prefer insight+steps+sleep'), id: z.string().optional() },
  wrap((a) => api('POST', '/api/items', { id: a.id, date: a.date, type: 'recovery', title: a.title, kind: a.kind, minutes: a.minutes, insight: a.insight, steps: a.steps, sleep: a.sleep, why: a.why })))

server.tool('schedule_supplement',
  "Put a SUPPLEMENT on a day (e.g. \"Creatine 5g\", \"Vitamin D\"). Shows as a pill under 🍽️ Fuel → Supplements. Include the dose in the title. `why` = your reason.",
  { date: DATE, title: z.string().describe('name + dose, e.g. "Creatine 5g"'), why: z.string().optional(), id: z.string().optional() },
  wrap((a) => api('POST', '/api/items', { id: a.id, date: a.date, type: 'supplement', title: a.title, why: a.why })))

server.tool('add_note',
  'Add a free-text note to a day (reminders, coaching cues).',
  { date: DATE, title: z.string().optional(), notes: z.string() },
  wrap((a) => api('POST', '/api/items', { date: a.date, type: 'note', title: a.title || a.notes.slice(0, 40), notes: a.notes })))

server.tool('remove_item', 'Delete a meal/mind/note item by id.',
  { id: z.string() }, wrap((a) => api('DELETE', `/api/items/${encodeURIComponent(a.id)}`)))

server.tool('notify',
  'Tell the athlete what you JUST did, in their voice-of-coach. Call this AFTER you create/adjust their plan or review a workout, so a short note appears in their notification bell (e.g. title "Updated your week", items ["Reviewed Monday\'s ride", "Added a rest day Thu", "Bumped Sat to 3h endurance"]). Keep it human and brief.',
  { title: z.string().describe('one-line summary, e.g. "Updated your training plan"'), body: z.string().optional().describe('optional one-line context'), items: z.array(z.string()).optional().describe('bullet list of what changed/was reviewed') },
  wrap((a) => api('POST', '/api/notify', { title: a.title, body: a.body, items: a.items })))

server.tool('save_coach_review',
  'Save YOUR PRIVATE review of a COMPLETED workout. Shows in the athlete\'s post-workout view + Progress, AND (when activityId is given) is auto-posted to the intervals Notes/comment thread in the standard "Coach note" format. This is the PRIVATE channel — put score, mind, recovery, health, and next-plan context HERE, never in the public title/description (use set_activity_text for that). Give a one-line verdict, 2-4 takeaways, and what\'s next.',
  { date: z.string().describe('the workout date, YYYY-MM-DD'), verdict: z.string().optional().describe('one-line overall verdict, e.g. "Solid threshold work — held the watts, legs faded late."'), takeaways: z.array(z.string()).optional().describe('2-4 short bullets shown on the Progress card'), execution: z.array(z.string()).optional().describe('what went well / the main limiter'), body: z.string().optional().describe('body-maintenance action or "no new issue"'), next: z.string().optional().describe('what to do next / next session focus'), recovery: z.string().optional().describe('recovery + nutrition/supplement note (posted as a second Recovery/Supplements comment)'), sport: z.string().optional().describe('ride | run | gym'), score: z.number().optional().describe('execution score 0-10 (shown as N/10)'), planId: z.string().optional().describe('the planned workout id, if reviewing one'), activityId: z.string().optional().describe('the intervals activity id, if reviewing a completed device activity — REQUIRED for the note to sync to intervals') },
  wrap((a) => api('POST', '/api/coach-review', { date: a.date, verdict: a.verdict, takeaways: a.takeaways, execution: a.execution, body: a.body, next: a.next, recovery: a.recovery, sport: a.sport, score: a.score, planId: a.planId, activityId: a.activityId })))

server.tool('set_activity_text',
  'Set the PUBLIC title + description on a COMPLETED intervals activity (this SYNCS TO STRAVA and is visible to others). PUBLIC-SAFE ONLY: no score, health/pain/niggles, fatigue/recovery status, feelings ("felt good so I…"), PREGNANCY or trimester (PRIVATE — never mention pregnancy or anything implying it, anywhere), or future-plan protection (those go in save_coach_review, the private Notes thread). TWO DIFFERENT VOICES: the TITLE is HUMAN + creative, a normal athlete Strava title (route, session type, a segment/KOM/Local Legend, keep it fun, e.g. "KOM on the Backroads" or "Another Local Legend, Relaxed Miles"); the DESCRIPTION is written like the ATHLETE would (natural, a little personality, the balance between a dry data line, a lecture, and a brag), one or two everyday sentences on the effort/zone (Z2, threshold) and what it was FOR (base, engine, sharpening) with FLOW, e.g. "Relaxed Z2 spin on the backroads, kept it easy the whole way, quiet base miles banking fitness for later". Do NOT restate the numbers already shown on the activity (avg power, duration), that is redundant and boring, describe the feel and the why instead. No physiology lecture ("mitochondrial density", "fat oxidation", "lactate", "excursions") and no cocky filler ("relaxing spin", "classic spin", "snagged a Local Legend"). NEVER use an em-dash in either field, use commas or periods. Follow instructions_public_text.',
  { activityId: z.string().describe('the intervals activity id (e.g. i161879537)'), name: z.string().describe('public title, concise + human'), description: z.string().optional().describe('public-safe ride/run description') },
  wrap((a) => api('PUT', `/api/activity/${a.activityId}/public-text`, { name: a.name, description: a.description })))

server.tool('set_weekly_target',
  "Set the week's MACRO TARGET (cyclingcoach parity) — the overall load/hours/focus goal for the week, stored + mirrored to intervals as a TARGET event. Set it when you plan or adjust a week, then build the individual sessions to hit it.",
  { weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("the week's Monday, YYYY-MM-DD"), hours: z.number().optional().describe('target ride/training hours'), load: z.number().optional().describe('target weekly training load (TSS)'), focus: z.string().optional().describe('the week\'s focus, e.g. "sweet-spot durability + one VO2 touch, long aerobic Saturday"'), note: z.string().optional() },
  wrap((a) => api('POST', '/api/weekly-target', { weekStart: a.weekStart, hours: a.hours, load: a.load, focus: a.focus, note: a.note })))

server.tool('set_load_plan',
  "Set/adjust the athlete's MULTI-WEEK LOAD periodization — the weekly TSS targets for the coming build/peak/recovery blocks (an ATP). This is the 4-week Load & Form FORECAST's top-priority source, so setting it makes the projection reflect YOUR plan (not a flat held-load). Use it when you lay out or revise a training BLOCK across weeks (for a single week use set_weekly_target). Respect the weekly-load BAND (sustainable ×7 / build ×9 / hard ×11 of CTL): a week ABOVE the cap (~×12 CTL) is an intentional OVERLOAD that must be a NAMED, justified block — the response returns any `overCap` weeks; ease them or name the reason, don't leave an accidental spike.",
  { weeks: z.array(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("the week's Monday, YYYY-MM-DD"), target: z.number().describe('weekly training load (TSS) target'), phase: z.string().optional().describe('build | peak | recovery | base'), focus: z.string().optional().describe("the week's focus in a short phrase") })).describe('the weekly load blocks, in order') },
  wrap((a) => api('POST', '/api/coach/load-plan', { weeks: a.weeks })))

server.tool('finish_onboarding',
  'Call this ONCE at the END of onboarding a brand-new athlete — AFTER you have saved their profile (set_athlete_profile) AND drafted their first week. It marks setup complete so the app stops showing the "set me up" prompt. Do not call it before the first week exists.',
  {},
  wrap(() => api('POST', '/api/onboarding/complete', {})))

await server.connect(new StdioServerTransport())
console.error(`platyplus-mcp ready -> ${BASE}`)
