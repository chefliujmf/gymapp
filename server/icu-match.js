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

// Sport bucket for an intervals event TYPE (Ride/Run/WeightTraining → ride/run/gym).
export const eventSport = (type) => (type === 'Ride' ? 'ride' : type === 'Run' ? 'run' : 'gym')
// A planned "slot" key — one workout per day+sport.
export const slotKey = (date, sport) => `${String(date).slice(0, 10)}|${sport}`

// Reconcile drop decision (#185, pure + tested): should a STORED plan be removed because
// intervals no longer backs it? `ctx`:
//   liveIds   — Set of event ids currently live in the synced window
//   liveSlots — Set of slotKey(date,sport) that have a live WORKOUT event in the window
//   from,to   — the synced window (only judge plans inside it)
// Rules (Platyplus stays master for what it solely owns):
//   • never pushed (no icuEventId) → keep (locally authored, Platyplus owns it)
//   • outside the window → keep (we didn't look there)
//   • its mirror event is still live → keep
//   • mirror gone + icu-ORIGIN → drop (it only existed as a mirror)
//   • mirror gone + platyplus-origin → drop ONLY if the slot now has a live (replacement)
//     event; a pure intervals deletion with no replacement is kept (respects #160).
export function planDroppedByReconcile(plan, { liveIds, liveSlots, from, to }) {
  if (!plan || !plan.icuEventId) return false
  if ((from && plan.date < from) || (to && plan.date > to)) return false
  if (liveIds.has(plan.icuEventId)) return false
  if (plan.origin === 'icu') return true
  return liveSlots.has(slotKey(plan.date, plan.sport))
}
