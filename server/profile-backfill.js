// #519 follow-up — one-time back-fill of athlete-specific context that USED to be hardcoded in the shared
// cycling engine, now moved to the per-user PROFILE where it belongs (multi-user correctness: the shared
// engine must not carry one athlete's goal/travel rhythm). The app calls `mergedProfile` for every user at
// boot; it is IDEMPOTENT (guarded by a marker already in the profile), so it applies once and then no-ops on
// every subsequent boot. Safe to re-run. New users' goals come from onboarding + the coach's
// `set_athlete_profile`, NEVER from here — this only seeds the pre-existing hardcoded athlete(s). Pure +
// unit-tested (src/profile-backfill.test.ts). Remove an entry once it has landed everywhere.

export const PROFILE_BACKFILL = {
  'jmfiset@gmail.com': `## Goal & travel rhythm
Goal: raise FTP toward ~300 W over time — an aspirational marker, not a deadline; don't use it to justify reckless load. Center training on repeatable threshold + aerobic durability, long-term all-round development.
Cottage (Skov) rhythm: alternating months at the cottage (Austin, QC) — cottage months June/Aug/Oct/Dec 2026, then Jan/Mar/May/Jul/Sep/Nov 2027. On cottage weekends don't assume bike/gym access: use Friday-before / Monday-after, mobility, rest, or land-work, and Friday can be the main load anchor when Sunday is a travel/return day. Manual land work (cutting, hauling, digging) counts as recovery load, not bike training.`,
}

// Idempotency guard: if the athlete's profile already contains this phrase, the back-fill has run — skip.
export const BACKFILL_MARKER = 'Cottage (Skov) rhythm'

// Return the athlete's coachProfile WITH the back-fill appended, or null when there is nothing to do
// (email not in the map, or the marker is already present). Preserves any existing profile content.
export function mergedProfile(email, currentProfile = '') {
  const add = PROFILE_BACKFILL[String(email || '').toLowerCase().trim()]
  if (!add) return null
  const cur = String(currentProfile || '')
  if (cur.includes(BACKFILL_MARKER)) return null
  const trimmed = cur.trim()
  return (trimmed ? trimmed + '\n\n' + add : add).trim()
}
