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

// #522 — strip APP-LEVEL / coaching-METHOD content that polluted per-athlete profiles (leftover from the old
// standalone cyclingcoach athlete_profile.md). These behaviours live in the SHARED engine and apply to EVERY
// athlete, so they must not sit in one person's profile (redundant + drift). Removes: the whole "Current project
// assumptions" infra section (Intervals/Wahoo/Google-Calendar workflow), and bullets that are pure method — the
// coach-memory upkeep, the public activity-text voice, and the COACHCHECK command. Genuine athlete facts (goal,
// FTP status, equipment, injuries, gym/travel prefs, psychology) are kept. Pure + idempotent (re-run strips
// nothing more) + unit-tested (src/migrations.test.ts).
const METHOD_BULLET = /coach_feedback_memory|Strava[- ]facing|public\s+(ride|activity)\b[^\n]{0,40}\bpreference|chat trigger|\bCOACHCHECK\b/i
export function stripProfileMethod(md) {
  const src = String(md || '')
  if (!src.trim()) return src
  const lines = src.replace(/\r/g, '').split('\n')
  const out = []
  let skipSection = false
  for (const ln of lines) {
    if (/^#{1,3}\s*Current project assumptions/i.test(ln)) { skipSection = true; continue } // drop the infra section
    if (skipSection) { if (/^#{1,3}\s/.test(ln)) skipSection = false; else continue }        // …until the next heading
    if (/^\s*[-*]\s/.test(ln) && METHOD_BULLET.test(ln)) continue                            // drop pure-method bullets
    out.push(ln)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
