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
  'Search the Platyplus exercise library by name; returns ids (exId) with demo media. Use the exId in create_workout so the app shows the right demo video.',
  { query: z.string().describe('name fragment, e.g. "goblet squat"'), limit: z.number().int().min(1).max(100).optional() },
  wrap((a) => api('GET', `/api/exercises?q=${encodeURIComponent(a.query)}&limit=${a.limit || 20}`)))

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

// --- training -------------------------------------------------------------
server.tool('create_workout',
  'Schedule a strength/gym workout on a date. Mirrors to intervals.icu in the canonical [gymapp] format the app parses. Re-call with the same id to UPDATE. Send the session the coach generated as-is (warm-up + cool-down, main set ordered by equipment, unilateral moves listed for both sides) — Platyplus stores exactly what you send.',
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
    id: z.string().optional().describe('omit to create (a new id is returned); pass it back to update'),
  },
  wrap((a) => api('POST', '/api/plan', {
    id: a.id || newId(), date: a.date, sport: 'gym', title: a.title,
    rounds: a.rounds || 1, exercises: a.exercises, notes: a.notes || '',
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
}))

server.tool('create_ride',
  'Schedule a structured bike workout (power intervals). Mirrors to intervals.icu as a real workout (steps), so it can ride to a head unit/trainer. Re-call with same id to update.',
  { date: DATE, title: z.string(), ftp: z.number().optional().describe('override FTP in watts'), segments: SEGMENTS, notes: z.string().optional(), id: z.string().optional() },
  makeEndurance('ride'))

server.tool('create_run',
  'Schedule a structured run (pace/effort intervals as % of threshold). Re-call with same id to update.',
  { date: DATE, title: z.string(), ftp: z.number().optional(), segments: SEGMENTS, notes: z.string().optional(), id: z.string().optional() },
  makeEndurance('run'))

server.tool('remove_workout', 'Delete a scheduled workout/ride/run by id (also removes its intervals.icu mirror).',
  { id: z.string() }, wrap((a) => api('DELETE', `/api/plan/${encodeURIComponent(a.id)}`)))

// --- nutrition / mind / notes --------------------------------------------
server.tool('schedule_meal',
  'Put a meal on a day (Platyplus calendar; no intervals push).',
  { date: DATE, title: z.string(), recipeId: z.string().optional().describe('Platyplus recipe id, if linking one'), mealType: z.string().optional().describe('breakfast | lunch | dinner | snack'), kcal: z.number().optional(), id: z.string().optional() },
  wrap((a) => api('POST', '/api/items', { id: a.id, date: a.date, type: 'meal', title: a.title, refId: a.recipeId, mealType: a.mealType, kcal: a.kcal })))

server.tool('schedule_mind',
  'Put a mind/recovery session (meditation, breathing) on a day.',
  { date: DATE, title: z.string(), minutes: z.number().optional(), refId: z.string().optional(), id: z.string().optional() },
  wrap((a) => api('POST', '/api/items', { id: a.id, date: a.date, type: 'mind', title: a.title, minutes: a.minutes, refId: a.refId })))

server.tool('add_note',
  'Add a free-text note to a day (reminders, coaching cues).',
  { date: DATE, title: z.string().optional(), notes: z.string() },
  wrap((a) => api('POST', '/api/items', { date: a.date, type: 'note', title: a.title || a.notes.slice(0, 40), notes: a.notes })))

server.tool('remove_item', 'Delete a meal/mind/note item by id.',
  { id: z.string() }, wrap((a) => api('DELETE', `/api/items/${encodeURIComponent(a.id)}`)))

await server.connect(new StdioServerTransport())
console.error(`platyplus-mcp ready -> ${BASE}`)
