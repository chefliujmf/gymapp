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

// does the gym on this date/plan/activity have feedback anywhere it could live?
export function gymHasFeedback(user, { date, planId, activityId } = {}) {
  const fb = (user && user.activityFeedback) || {}
  const keys = [planId, activityId != null ? String(activityId) : null, date ? `gym-${date}` : null].filter(Boolean)
  if (keys.some((k) => fbHasContent(fb[k]))) return true
  const plans = (user && user.plans) || []
  const plan = planId ? plans.find((p) => p && p.id === planId) : null
  if (plan && fbHasContent(plan.feedback)) return true
  if (date && plans.some((p) => p && p.sport === 'gym' && String(p.date).slice(0, 10) === date && fbHasContent(p.feedback))) return true
  return false
}

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
