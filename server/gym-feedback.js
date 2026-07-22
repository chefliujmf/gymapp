// #723 (audit / JM's wife) — GYM feedback lives in the Platyplus store (keyed by plan id, activity id, or `gym-{date}`),
// NOT on the intervals activity like ride/run feel/RPE. Before this, TWO layers had a gym blind spot: the client nag
// (#679) excluded gym entirely, and the coach's awaitingFeedback grace (#681) read the intervals feel/RPE — so a
// completed gym NEVER nagged AND the coach reviewed it as "no feedback given". These are the ONE source of truth for
// "does this gym have feedback?", read by BOTH the coach grace AND the client banner, so they can never disagree.
// Pure + unit-tested (src/gym-feedback.test.ts).
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

// a feedback record counts only when it carries REAL content (a feel, an RPE, a filled field, or a note) — an empty
// stub the UI may create must NOT satisfy the nag.
export const fbHasContent = (v) => !!(v && (v.feel || v.rpe || (v.fields && Object.keys(v.fields).length) || (v.note && String(v.note).trim())))

// #723 (JM HARD RULE) — "the user MUST enter feedback to get a coach review, there is no way around it." Feedback is
// ALWAYS stored in the Platyplus store when the athlete logs it: `activityFeedback[activityId]` (mirrored to the linked
// plan id) for a device activity, or `plan.feedback` for a planned session, plus the `gym-{date}` key for a gym. This is
// the ONE universal "did the athlete log how it went?" check, used by (a) the coach-review SAVE guard (a 409 so a review
// physically cannot be written without feedback — the daily pass used to do a "data-only" review past a 1-day grace,
// which is exactly the bug the wife hit), and (b) the awaitingFeedback skip flag + the review-gap nags. All sports.
export function hasSessionFeedback(user, { activityId, planId, date, sport } = {}) {
  const fb = (user && user.activityFeedback) || {}
  if (activityId != null && fbHasContent(fb[String(activityId)])) return true
  const plans = (user && user.plans) || []
  if (planId) {
    if (fbHasContent(fb[planId])) return true
    const p = plans.find((x) => x && x.id === planId)
    if (p && fbHasContent(p.feedback)) return true
  }
  // gym feedback also lives under a `gym-{date}` key / on the day's gym plan — only consult these for a gym (or when the
  // sport is unknown), so a non-gym review can't be satisfied by a same-day gym's feedback.
  const isGym = /gym|weight|strength|workout/i.test(String(sport || ''))
  if (date && (isGym || !sport)) {
    if (fbHasContent(fb[`gym-${date}`])) return true
    if (plans.some((p) => p && p.sport === 'gym' && String(p.date).slice(0, 10) === date && fbHasContent(p.feedback))) return true
  }
  return false
}

// gym-specific alias (the review-gap nag is gym-only; endurance nags come from the intervals feel/RPE path).
export function gymHasFeedback(user, opts = {}) { return hasSessionFeedback(user, { ...opts, sport: 'gym' }) }

// completed gym LOGS in the last `sinceDays` that still lack feedback — oldest first (the banner + review list nag these).
export function gymFeedbackGaps(user, today, sinceDays = 14) {
  const cutoff = addDays(today, -sinceDays)
  const plans = (user && user.plans) || []
  const seen = new Set(), out = []
  for (const l of ((user && user.logs) || [])) {
    if (!l || !l.date || l.date < cutoff || l.date > today || !/strength|gym/i.test(String(l.discipline || '')) || seen.has(l.date)) continue
    seen.add(l.date)
    const plan = plans.find((p) => p && p.sport === 'gym' && String(p.date).slice(0, 10) === l.date)
    if (!gymHasFeedback(user, { date: l.date, planId: plan && plan.id })) out.push({ date: l.date, title: (plan && plan.title) || l.title || 'Strength', planId: plan && plan.id })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
