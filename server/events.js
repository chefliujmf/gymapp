// #760 (JM 2026-07-24) — structured season EVENTS (races · trips · camps · anything on the calendar that shapes
// training). Sport-agnostic: the free-text NAME carries the specifics (the coach reads it), and ONE structured lever —
// the "job" — is what the periodization CODE drives off. Optional: no events ⇒ everything here is silent and the plan
// runs its normal block cycle. Pure + unit-tested (src/events.test.ts). The coach reads these via MCP get_events + the
// `# SEASON` prompt block; the nearest "peak" event feeds periodizationPhase's weeksToRace/taper.

export const EVENT_JOBS = ['peak', 'ready', 'block', 'note']
// What each job MEANS for the plan — the only thing the coach needs to treat the event correctly.
export const JOB_META = {
  peak:  { label: 'A goal to peak for',        short: 'peak for it',   taper: true,  note: 'BUILD → PEAK → TAPER so they are at their best on the day. Taper length scales with the demand read from the name.' },
  ready: { label: 'Something to be ready for',  short: 'be ready',      taper: false, note: 'BUILD the specific fitness to arrive capable and enjoy it — do NOT taper (it is not a race). Read the name for what to prepare for (climbing, distance, terrain).' },
  block: { label: 'A big block of training',    short: 'big block',     taper: false, note: 'The event IS a big load itself: keep the days before manageable so they arrive fresh enough to absorb it, then program a real RECOVERY block AFTER — do not stack hard work on top.' },
  note:  { label: 'Just on my calendar',        short: 'just noted',    taper: false, note: 'Keep the normal plan; just account for the day(s) so nothing clashes. No peak, no taper, no reshaping.' },
}

export function validateEvent(b) {
  if (!b || typeof b !== 'object') return 'event object required'
  if (!b.name || !String(b.name).trim()) return 'name is required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.start || ''))) return 'start (YYYY-MM-DD) is required'
  if (b.end && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.end))) return 'end must be YYYY-MM-DD'
  if (b.end && String(b.end) < String(b.start)) return 'end must be on or after start'
  if (!EVENT_JOBS.includes(b.job)) return `job must be one of: ${EVENT_JOBS.join(', ')}`
  return null
}

// normalize an incoming event into the stored shape (id assigned by the caller if new)
export function normEvent(b, id) {
  return {
    id: id || b.id,
    name: String(b.name).trim().slice(0, 120),
    start: String(b.start).slice(0, 10),
    end: b.end ? String(b.end).slice(0, 10) : undefined,
    job: b.job,
    sport: typeof b.sport === 'string' ? b.sport.slice(0, 20) : undefined,
    at: b.at || Date.now(),
  }
}

export const weeksBetween = (fromISO, toISO) => Math.floor((Date.parse(String(toISO).slice(0, 10) + 'T00:00:00Z') - Date.parse(String(fromISO).slice(0, 10) + 'T00:00:00Z')) / (7 * 86400000))
const endOf = (e) => e.end || e.start

// upcoming = not yet finished, in date order. horizonDays bounds how far ahead we surface (a season, ~6 months default).
export function upcomingEvents(events, todayISO, horizonDays = 220) {
  const cutoff = new Date(Date.parse(todayISO + 'T00:00:00Z') + horizonDays * 86400000).toISOString().slice(0, 10)
  return (events || []).filter((e) => e && e.name && endOf(e) >= todayISO && e.start <= cutoff).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

// The nearest FUTURE "peak" event is the one that drives the current periodization phase + taper.
export function nearestPeakEvent(events, todayISO) {
  return (events || []).filter((e) => e && e.job === 'peak' && endOf(e) >= todayISO).sort((a, b) => (a.start < b.start ? -1 : 1))[0] || null
}

// #752-style distance-aware taper, read from the event NAME (the athlete's own words carry it).
export function taperWeeksForName(name) {
  const n = String(name || '').toLowerCase()
  if (/ironman|140\.?6|full[- ]?distance|full ?iron/.test(n)) return 4
  if (/70\.?3|half[- ]?iron|half[- ]?distance/.test(n)) return 3
  if (/marathon|ultra|gran ?fondo|century|100 ?(mi|km)/.test(n)) return 2
  return 2 // shorter races: a ~2-week / few-day sharpen (periodizationPhase caps the actual taper)
}

// The `# SEASON` prompt block — lists the upcoming events + their jobs + weeks-out, and the sequencing rules.
// Empty events ⇒ '' (silent), so an athlete with no races sees/gets nothing.
export function seasonPromptBlock(events, todayISO) {
  const up = upcomingEvents(events, todayISO)
  if (!up.length) return ''
  const lines = up.map((e) => {
    const wk = weeksBetween(todayISO, e.start)
    const range = e.end && e.end !== e.start ? `–${e.end}` : ''
    const when = wk <= 0 ? 'this week' : `~${wk} wk${wk !== 1 ? 's' : ''} out`
    return `- "${e.name}"${e.sport ? ` [${e.sport}]` : ''} on ${e.start}${range} (${when}) — ${JOB_META[e.job].short.toUpperCase()}: ${JOB_META[e.job].note}`
  })
  return `\n\n# SEASON / EVENTS — the athlete's upcoming events. SEQUENCE the plan by DATE; the nearest "peak for it" event drives the CURRENT phase:\n${lines.join('\n')}\nRULES: PEAK + TAPER only for the nearest "peak" event — a later peak WAITS (build toward it, don't peak early). If two "peak" events are too close to taper for both, fully peak the PRIORITY (nearest / more important), race the other on residual fitness (a train-through, NO second taper) and NOTIFY the athlete what you did. A "big block" (camp) — keep the days before easy enough to absorb it, then recover after. A "be ready" (trip/adventure) — build the specific fitness from its NAME, do NOT taper. "Just noted" — leave the plan, only avoid clashing on those days. This block is empty when they have no events — then just run the normal block cycle.`
}
