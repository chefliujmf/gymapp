import { isoMonday } from './readiness.js'

const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

/**
 * #371/#454/#5014 — the athlete's caps for a COACH-created OR COACH-MOVED plan, as a PURE check:
 *  · maxPerDay — at most `info.maxPerDay` (default 1) sessions on any calendar day.
 *  · weekly training days — at most `info.trainingDays` distinct training days per Mon–Sun week (0 = unset → skip).
 * EXCLUDES the plan itself (`body.id`) from the counts, so MOVING a session onto another day is checked against the
 * OTHER sessions there — not itself (the #5014 gap: the old inline guard fired only on CREATE, so a coach could MOVE a
 * session onto a full day and stack two). Returns a 409 `{ status, body:{ error } }` to reject, or `null` to allow.
 */
export function planCapViolation(plans, body, info) {
  const list = plans || []
  const maxPerDay = Math.max(1, Number(info?.maxPerDay) || 1)
  const sameDay = list.filter((p) => p.date === body.date && p.id !== body.id)
  if (sameDay.length >= maxPerDay) {
    return { status: 409, body: { error: `Rejected — ${body.date} already has ${sameDay.length} session(s) and the athlete's max is ${maxPerDay}/day (${sameDay.map((p) => `"${p.title}"`).join(', ')}). Do NOT stack sessions: either COMBINE this into that day's existing session (re-call create_* with THAT session's id to make it one longer/richer workout) or move it to a free day. Two short rides of the same sport should be ONE session, not two.` } }
  }
  const freq = Math.max(0, Number(info?.trainingDays) || 0)
  if (freq > 0) {
    const wkStart = isoMonday(body.date), wkEnd = addDays(wkStart, 6)
    const daysThisWeek = new Set(list.filter((p) => p.date >= wkStart && p.date <= wkEnd && p.id !== body.id).map((p) => p.date))
    if (!daysThisWeek.has(body.date) && daysThisWeek.size >= freq) {
      return { status: 409, body: { error: `Rejected — the week of ${wkStart} already has ${daysThisWeek.size} training day(s) and the athlete's HARD weekly cap is ${freq}/week (${[...daysThisWeek].sort().join(', ')}). Do NOT exceed it: MOVE an existing session onto ${body.date}, or fold this into a day that's already training. If they genuinely want more days, they must raise the cap in their profile first.` } }
    }
  }
  return null
}
