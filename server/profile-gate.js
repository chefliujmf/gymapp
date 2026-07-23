// #A (audit #743/#748, JM 2026-07-22) — the coach must NOT plan on missing basics (that's how a teen with no DOB fell
// through to an adult VO2 build). Plan generation is GATED on a minimal, mandatory profile: sex · DOB · main sport ·
// goal · training-days/week — and if she's PREGNANT, an EDD/LMP date is ALSO mandatory (it drives the trimester-safe
// limits). Until it's complete the app shows a "complete your profile" gate instead of a plan, and the daily-adapt
// skips. Pure + unit-tested; the client mirrors this in src/profileGate.ts (keep in sync).
export const REQUIRED_FIELDS = [
  { key: 'sex', label: 'Sex', hint: 'so female-athlete + cycle/pregnancy coaching applies', icon: '🚻' },
  { key: 'dob', label: 'Date of birth', hint: 'drives teen / masters safety limits', icon: '🎂' },
  { key: 'mainSport', label: 'Main sport', hint: 'the coach plans for what you actually do', icon: '🏅' },
  { key: 'goal', label: 'Your goal', hint: 'build / maintain / a race — in your own words', icon: '🎯' },
  { key: 'trainingDays', label: 'Training days / week', hint: 'how many days you want to train', icon: '📅' },
  { key: 'pregnancyDate', label: 'Due date (or last period)', hint: 'sets your trimester — required while pregnant', icon: '📆', pregnancyOnly: true },
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
  // pregnancy → the date is mandatory (EDD or LMP); without it we can't pick the trimester-safe envelope.
  if (info.pregnant && !info.dueDate && !info.pregnancyStart) gaps.push('pregnancyDate')
  return gaps
}

export const profileComplete = (user) => requiredProfileGaps(user).length === 0
