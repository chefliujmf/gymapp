// #A (audit #743/#748, JM 2026-07-22) — the coach must NOT plan on missing basics (that's how a teen with no DOB fell
// through to an adult VO2 build). Plan generation is GATED on a minimal, mandatory profile: sex · DOB · main sport ·
// goal · training-days/week. Until it's complete the app shows a lightweight "finish your profile" pointer instead of a
// plan, and the daily-adapt skips. Pure + unit-tested; the client mirrors this in src/profile-fields.ts (keep in sync).
//
// #759/#760 (JM 2026-07-23) — a PRIVATE/medical field must NEVER hard-block the app. The pregnancy date is NO LONGER a
// gate: forcing an EDD/LMP to unlock the plan is a consent violation (she may not want to share it). Instead, a pregnant
// user is NEVER blocked — she gets the gentlest pregnancy-SAFE envelope by default (see week-shape.js/server.js, keyed on
// info.pregnant ALONE, not sex+exact-date), and the trimester/date stays OPTIONAL in Profile to FINE-TUNE. So the gate
// = only the 5 non-sensitive basics.
export const REQUIRED_FIELDS = [
  { key: 'sex', label: 'Sex', hint: 'so female-athlete + cycle/pregnancy coaching applies', icon: '🚻' },
  { key: 'dob', label: 'Date of birth', hint: 'drives teen / masters safety limits', icon: '🎂' },
  { key: 'mainSport', label: 'Main sport', hint: 'the coach plans for what you actually do', icon: '🏅' },
  { key: 'goal', label: 'Your goal', hint: 'build / maintain / a race — in your own words', icon: '🎯' },
  { key: 'trainingDays', label: 'Training days / week', hint: 'how many days you want to train', icon: '📅' },
]

export function requiredProfileGaps(user) {
  const info = (user && user.info) || {}
  const gaps = []
  if (!user || !user.sex) gaps.push('sex')
  if (!info.dob) gaps.push('dob')
  const hasSport = !!info.mainSport || (Array.isArray(user && user.sports) && user.sports.length > 0)
  if (!hasSport) gaps.push('mainSport')
  const goal = (info.goals && (String(info.goals.focus || '').trim() || String(info.goals.notes || '').trim())) || (user && user.coachProfile && user.coachProfile.trim())
  if (!goal) gaps.push('goal')
  if (!(Number(info.trainingDays) > 0)) gaps.push('trainingDays')
  // #759 — pregnancy date is DELIBERATELY NOT gated (consent): a pregnant user is never blocked; she defaults to the
  // safe envelope and the date is an optional fine-tune. Do NOT re-add a pregnancyDate gap here.
  return gaps
}

export const profileComplete = (user) => requiredProfileGaps(user).length === 0
