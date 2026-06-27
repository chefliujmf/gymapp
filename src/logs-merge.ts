// History day-merge + dedup (pure, unit-tested in logs-merge.test.ts).
//
// The bug it fixes (#197): a completed workout could show TWICE on a day — a stale
// local `db.logs` entry AND the real device activity from intervals — because the
// old dedup compared a log's discipline to the activity's sport with `sportBucket`
// that fell through to the raw string, so an odd/empty discipline never matched.
// Here we collapse to ONE entry per (day, sport): a gym session (with sets) beats a
// device activity beats a bare log. intervals = the read hub, so a device activity is
// the trusted record of an endurance session; a gym log carries the sets a device can't.
import type { WorkoutLog } from './db'
import { sportOfActivity, type IcuActivity } from './intervals'
import type { Checkin } from './auth/api'

export type LogEntry =
  | { kind: 'gym'; log: WorkoutLog }
  | { kind: 'log'; log: WorkoutLog }
  | { kind: 'device'; act: IcuActivity }

export type DayBucket = { checkin?: Checkin; entries: LogEntry[] }

/** Normalize any discipline/type string to one sport bucket (never the raw string). */
export function bucketSport(s?: string): string {
  const d = String(s || '').toLowerCase()
  if (/cycl|ride|bike|spin/.test(d)) return 'ride'
  if (/run|jog/.test(d)) return 'run'
  if (/strength|gym|weight|lift/.test(d)) return 'gym'
  if (/swim/.test(d)) return 'swim'
  if (/yoga|pilates|mobility|stretch|meditat|mind|breath/.test(d)) return 'mind'
  if (/walk|hike/.test(d)) return 'walk'
  return 'other'
}

const rank = (e: LogEntry) => (e.kind === 'gym' ? 3 : e.kind === 'device' ? 2 : 1)
const sportOf = (e: LogEntry) => (e.kind === 'device' ? bucketSport(sportOfActivity(e.act)) : bucketSport(e.log.discipline))
const dayOf = (e: LogEntry) => (e.kind === 'device' ? (e.act.start_date_local || '').slice(0, 10) : e.log.date)

/**
 * Group completed work by day, collapsing to at most ONE entry per (day, sport).
 * When a stale local log and the real device activity overlap, the richer/truer
 * one wins (gym-with-sets > device activity > bare log) — no phantom duplicate.
 */
export function buildDayEntries(logs: WorkoutLog[], acts: IcuActivity[], checkins: Checkin[] = []): Map<string, DayBucket> {
  const all: LogEntry[] = []
  for (const l of logs) {
    const hasSets = !!(l.sets && Object.keys(l.sets).length)
    all.push(hasSets ? { kind: 'gym', log: l } : { kind: 'log', log: l })
  }
  for (const a of acts) if ((a.start_date_local || '').slice(0, 10)) all.push({ kind: 'device', act: a })

  // collapse per (day | sport): keep the highest-ranked entry for that slot
  const best = new Map<string, LogEntry>()
  for (const e of all) {
    const d = dayOf(e); if (!d) continue
    const key = d + '|' + sportOf(e)
    const cur = best.get(key)
    if (!cur || rank(e) > rank(cur)) best.set(key, e)
  }

  const byDay = new Map<string, DayBucket>()
  const day = (d: string) => { const x = byDay.get(d) || { entries: [] as LogEntry[] }; byDay.set(d, x); return x }
  for (const e of best.values()) day(dayOf(e)).entries.push(e)
  for (const c of checkins) day(c.date).checkin = c
  return byDay
}
