// Pure helpers for matching a Platyplus plan to an intervals.icu planned EVENT (#150 dedup).
// No side effects → safe to import from the server AND from unit tests.

// Normalise a workout title for fuzzy comparison: lowercase, DROP trailing "#hashtags"
// (another coach appends e.g. " #Codex Coach #Aggressive June Build"), collapse whitespace.
export const normTitle = (s) => String(s || '').toLowerCase().split('#')[0].replace(/\s+/g, ' ').trim()

// Strip the ":YYYY-MM-DD" instance suffix intervals adds to external_id on re-push/recurring.
const stripInstance = (s) => String(s || '').replace(/:\d{4}-\d{2}-\d{2}$/, '')

const wantType = (sport) => (sport === 'ride' ? 'Ride' : sport === 'run' ? 'Run' : 'WeightTraining')

// Does this intervals event already represent the plan? (so we don't create a duplicate)
// — same external_id (our id), OR same sport + fuzzy-equal title (handles the other coach's
// "#Codex Coach" suffix). Non-WORKOUT events (notes/targets) never match.
export function eventMatchesPlan(plan, event) {
  if (!plan || !event) return false
  if (event.category && event.category !== 'WORKOUT') return false
  if (event.external_id && plan.id && stripInstance(event.external_id) === plan.id) return true
  if (event.type !== wantType(plan.sport)) return false
  const n = normTitle(event.name), t = normTitle(plan.title)
  return !!n && !!t && (n === t || n.startsWith(t) || t.startsWith(n))
}
