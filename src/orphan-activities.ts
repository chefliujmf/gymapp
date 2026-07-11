// #5013 — a COMPLETED intervals activity with no matching plan/event on its day is an UNPLANNED
// workout (e.g. a strength session done off-plan). Both Today (#455) and Calendar (#5013) must still
// show the day as trained, not "Nothing planned". This is the shared, pure orphan-detection rule.
import { sportOf, sportOfActivity, type IcuEvent, type IcuActivity } from './intervals'

// Put a plan sport ('ride'|'run'|'gym') and an event/activity sport on ONE scale so they compare.
export const normSport = (s: string) => (s === 'cycling' ? 'ride' : s === 'running' ? 'run' : s)

type PlanLike = { date: string; sport: string }

/** Activities on `day` whose sport is NOT already covered by a plan or event that day. */
export function orphanActivities(day: string, plans: PlanLike[], events: IcuEvent[], activities: IcuActivity[]): IcuActivity[] {
  const covered = new Set<string>()
  for (const p of plans) if (p.date === day) covered.add(normSport(p.sport))
  for (const e of events) if (e.start_date_local.slice(0, 10) === day) covered.add(normSport(sportOf(e)))
  return activities.filter((a) => (a.start_date_local || '').slice(0, 10) === day && !covered.has(sportOfActivity(a)))
}
