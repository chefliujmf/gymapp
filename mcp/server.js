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
  'Search the Platyplus recipe library to PICK a real meal for fueling; returns ids + macros (kcal, protein). Use the id as recipeId in schedule_meal so the meal links to the recipe. Filter by category and/or a name/tag query. (Pick however many meals/snacks the day warrants per your nutrition knowledge — variable, not fixed.)',
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

server.tool('set_sports',
  'Set the athlete\'s sports (drives the app navigation + which coaching modules apply). Allowed: cycling, running, strength, yoga, pilates, meditation.',
  { sports: z.array(z.string()).describe('e.g. ["cycling","strength"]') },
  wrap((a) => api('PUT', '/api/profile', { sports: a.sports })))

// --- training -------------------------------------------------------------
// Structured coaching the app renders as the plan SHELL (Platyplus is master; this
// also mirrors into the intervals description). The meals/sessions themselves are
// SEPARATE items (schedule_meal/schedule_mind, each with a per-pick `why`); fuel.why
// and mind.why here are the STRATEGY, not the picks.
const COACHING = {
  objective: z.string().optional().describe('one-line goal of the session'),
  cues: z.array(z.string()).optional().describe('short in-session cues'),
  success: z.string().optional().describe('what "done well" looks like'),
  recovery: z.string().optional().describe('post / evening / next-AM recovery guidance'),
  fuel: z.object({ why: z.string().optional().describe('Pre/During/Post fueling strategy'), supplements: z.string().optional() }).optional(),
  mind: z.object({ why: z.string().optional().describe('mental-focus theme') }).optional(),
}
const coachingOf = (a) => ({ objective: a.objective, cues: a.cues, success: a.success, recovery: a.recovery, fuel: a.fuel, mind: a.mind })
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
      weight: z.number().optional().describe('kg (optional)'),
      seconds: z.number().int().optional().describe('work seconds for timed mode'),
      rest: z.number().int().optional().describe('rest seconds (optional)'),
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

server.tool('add_note',
  'Add a free-text note to a day (reminders, coaching cues).',
  { date: DATE, title: z.string().optional(), notes: z.string() },
  wrap((a) => api('POST', '/api/items', { date: a.date, type: 'note', title: a.title || a.notes.slice(0, 40), notes: a.notes })))

server.tool('remove_item', 'Delete a meal/mind/note item by id.',
  { id: z.string() }, wrap((a) => api('DELETE', `/api/items/${encodeURIComponent(a.id)}`)))

await server.connect(new StdioServerTransport())
console.error(`platyplus-mcp ready -> ${BASE}`)
