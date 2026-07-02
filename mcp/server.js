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
  'Search the Platyplus exercise library by name; returns ids (exId), the equipment tag, and demo media. Use the exId in create_workout. IMPORTANT: pass `equipment` = the athlete\'s OWNED gear (see the profile) so you only ever prescribe exercises they can actually do; "Bodyweight" needs nothing.',
  { query: z.string().describe('name fragment, e.g. "goblet squat"'), equipment: z.string().optional().describe('comma-separated owned equipment to limit to, e.g. "Dumbbell,Bodyweight,Bands"'), limit: z.number().int().min(1).max(100).optional() },
  wrap((a) => api('GET', `/api/exercises?q=${encodeURIComponent(a.query)}&equipment=${encodeURIComponent(a.equipment || '')}&limit=${a.limit || 20}`)))

server.tool('search_recipes',
  "Search the Platyplus recipe library to PICK a real meal for fueling; returns ids + macros (kcal, protein) + each recipe's `diet`. Results are ALREADY filtered to the athlete's dietary preference (vegetarian → veg+vegan only, vegan → vegan only), so every result is safe to suggest — never recommend a meal outside what's returned. Use the id as recipeId in schedule_meal. Filter by category and/or a name/tag query. (Pick however many meals/snacks the day warrants — variable, not fixed.)",
  { query: z.string().optional().describe('name or tag fragment'), category: z.string().optional().describe('breakfast | lunch | dinner | snack'), limit: z.number().int().min(1).max(100).optional() },
  wrap((a) => api('GET', `/api/recipes?q=${encodeURIComponent(a.query || '')}&category=${encodeURIComponent(a.category || '')}&limit=${a.limit || 20}`)))

server.tool('search_sessions',
  'Search the Platyplus mind/movement library (meditation, yoga, pilates, breathing) to PICK a real session/class; returns ids + duration. Use the id as refId in schedule_mind. Filter by kind and/or a query. For a yoga/pilates day you SELECT a class here (you do not author poses).',
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

server.tool('get_recent_activities',
  "Read the athlete's recently COMPLETED activities from intervals.icu: date, type, indoor/outdoor, duration, distance, avg HR, avg power, Load (TSS), intensity (IF), RPE, feel. READ-ONLY; returns { connected:false } if intervals.icu isn't connected.",
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
  'Set the athlete\'s sports (drives the app navigation + which coaching modules apply). Allowed: cycling, running, strength, yoga, pilates, meditation.',
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
  'Schedule a strength/gym workout on a date. Platyplus is the MASTER and mirrors to intervals.icu. Re-call with the same id to UPDATE. Send the session as generated (warm-up + cool-down, main set ordered by equipment, unilateral moves both sides). Optionally attach the coaching shell (objective/cues/success/recovery/fuel/mind strategy); pick exercises via search_exercises.',
  {
    date: DATE,
    title: z.string(),
    rounds: z.number().int().positive().optional().describe('circuit rounds; default 1'),
    exercises: z.array(z.object({
      name: z.string(),
      exId: z.string().optional().describe('catalog id from search_exercises (links the demo)'),
      mode: z.enum(['reps', 'timed']).optional().describe("default 'reps'"),
      sets: z.number().int().optional(),
      reps: z.number().int().optional(),
      weight: z.number().optional().describe('kg (optional; the app auto-fills from e1RM if omitted)'),
      seconds: z.number().int().optional().describe('work seconds for timed mode'),
      rest: z.number().int().optional().describe('rest seconds (optional)'),
      tempo: z.string().optional().describe('lifting TEMPO / time-under-tension as 4 digits eccentric-pauseBottom-concentric-pauseTop, e.g. "3-1-1-0" = 3s lower, 1s pause, 1s lift, 0s top. Prescribe a slower eccentric (3-4s) for hypertrophy/control, faster for power. Omit if not relevant.'),
      tip: z.string().optional().describe('one short FORM cue for THIS lift, e.g. "brace hard, drive mid-foot, no bounce out of the hole"'),
    })).min(1).describe('ordered list of exercises'),
    notes: z.string().optional(),
    ...COACHING,
    id: z.string().optional().describe('omit to create (a new id is returned); pass it back to update'),
  },
  wrap((a) => api('POST', '/api/plan', {
    id: a.id || newId(), date: a.date, sport: 'gym', title: a.title,
    rounds: a.rounds || 1, exercises: a.exercises, notes: a.notes || '', ...coachingOf(a),
  })))

const SEGMENTS = z.array(z.object({
  minutes: z.number().positive(),
  powerStart: z.number().describe('% of FTP (ride) or threshold (run)'),
  powerEnd: z.number().optional().describe('% target at end of the segment; default = powerStart (steady)'),
  label: z.string().optional(),
})).min(1).describe('ordered segments (warm-up, work, recovery, cool-down, ...)')

const makeEndurance = (sport) => wrap((a) => api('POST', '/api/plan', {
  id: a.id || newId(), date: a.date, sport, title: a.title, ftp: a.ftp, notes: a.notes || '',
  segments: a.segments.map((s) => ({ duration: Math.round(s.minutes * 60), powerStart: s.powerStart, powerEnd: s.powerEnd ?? s.powerStart, label: s.label })),
  ...coachingOf(a),
}))

server.tool('create_ride',
  'Schedule a structured bike workout (power intervals). Platyplus is master; mirrors to intervals.icu as a real workout (steps → head unit/trainer). Re-call with same id to update. Optionally attach the coaching shell (objective/cues/success/recovery/fuel/mind).',
  { date: DATE, title: z.string(), ftp: z.number().optional().describe('override FTP in watts'), segments: SEGMENTS, notes: z.string().optional(), ...COACHING, id: z.string().optional() },
  makeEndurance('ride'))

server.tool('create_run',
  'Schedule a structured run (pace/effort intervals as % of threshold). Re-call with same id to update. Optionally attach the coaching shell.',
  { date: DATE, title: z.string(), ftp: z.number().optional(), segments: SEGMENTS, notes: z.string().optional(), ...COACHING, id: z.string().optional() },
  makeEndurance('run'))

server.tool('remove_workout', 'Delete a scheduled workout/ride/run by id (also removes its intervals.icu mirror).',
  { id: z.string() }, wrap((a) => api('DELETE', `/api/plan/${encodeURIComponent(a.id)}`)))

// --- nutrition / mind / notes --------------------------------------------
server.tool('schedule_meal',
  'Put a meal on a day. PICK a real recipe via search_recipes and pass its id as recipeId so it links. `why` = your one-line reason for THIS pick (shown as "Coach\'s pick" on the recipe page). Schedule as many meals/snacks as the day needs.',
  { date: DATE, title: z.string(), recipeId: z.string().optional().describe('Platyplus recipe id from search_recipes'), mealType: z.string().optional().describe('breakfast | lunch | dinner | snack'), kcal: z.number().optional(), why: z.string().optional().describe('why this pick for this athlete/day'), id: z.string().optional() },
  wrap((a) => api('POST', '/api/items', { id: a.id, date: a.date, type: 'meal', title: a.title, refId: a.recipeId, mealType: a.mealType, kcal: a.kcal, why: a.why })))

server.tool('schedule_mind',
  'Put a mind/movement session (meditation, yoga, pilates, breathing) on a day. PICK a real session via search_sessions and pass its id as refId. `why` = your reason for THIS pick (shown as "Coach\'s pick" on the session page).',
  { date: DATE, title: z.string(), minutes: z.number().optional(), refId: z.string().optional().describe('Platyplus session id from search_sessions'), why: z.string().optional().describe('why this pick'), id: z.string().optional() },
  wrap((a) => api('POST', '/api/items', { id: a.id, date: a.date, type: 'mind', title: a.title, minutes: a.minutes, refId: a.refId, why: a.why })))

server.tool('schedule_recovery',
  'Put a RECOVERY block on a day (sauna, cold plunge, massage, mobility, foam roll, easy walk). Shows in the 🛌 Recovery section. `why` = your reason for this athlete/day.',
  { date: DATE, title: z.string().describe('e.g. "Sauna"'), kind: z.enum(['sauna', 'cold', 'massage', 'mobility', 'foam', 'walk']).optional(), minutes: z.number().optional(), why: z.string().optional(), id: z.string().optional() },
  wrap((a) => api('POST', '/api/items', { id: a.id, date: a.date, type: 'recovery', title: a.title, kind: a.kind, minutes: a.minutes, why: a.why })))

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
  'Set the PUBLIC title + description on a COMPLETED intervals activity (this SYNCS TO STRAVA and is visible to others). PUBLIC-SAFE ONLY: describe the workout itself — type, route/place, terrain, effort style, conditions, duration. NEVER include score, health/pain/niggles, fatigue/recovery status, feelings ("felt good so I…"), or future-plan protection — those go in save_coach_review (the private Notes thread). Write like a human athlete wrote it (e.g. "Backroad Hill Efforts" / "KOM on the Backroads"), not a coach analysis. Follow instructions_public_text.',
  { activityId: z.string().describe('the intervals activity id (e.g. i161879537)'), name: z.string().describe('public title, concise + human'), description: z.string().optional().describe('public-safe ride/run description') },
  wrap((a) => api('PUT', `/api/activity/${a.activityId}/public-text`, { name: a.name, description: a.description })))

server.tool('set_weekly_target',
  "Set the week's MACRO TARGET (cyclingcoach parity) — the overall load/hours/focus goal for the week, stored + mirrored to intervals as a TARGET event. Set it when you plan or adjust a week, then build the individual sessions to hit it.",
  { weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("the week's Monday, YYYY-MM-DD"), hours: z.number().optional().describe('target ride/training hours'), load: z.number().optional().describe('target weekly training load (TSS)'), focus: z.string().optional().describe('the week\'s focus, e.g. "sweet-spot durability + one VO2 touch, long aerobic Saturday"'), note: z.string().optional() },
  wrap((a) => api('POST', '/api/weekly-target', { weekStart: a.weekStart, hours: a.hours, load: a.load, focus: a.focus, note: a.note })))

server.tool('finish_onboarding',
  'Call this ONCE at the END of onboarding a brand-new athlete — AFTER you have saved their profile (set_athlete_profile) AND drafted their first week. It marks setup complete so the app stops showing the "set me up" prompt. Do not call it before the first week exists.',
  {},
  wrap(() => api('POST', '/api/onboarding/complete', {})))

await server.connect(new StdioServerTransport())
console.error(`platyplus-mcp ready -> ${BASE}`)
