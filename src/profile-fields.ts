import type { User } from './auth/api'

// #A (audit #743/#748) — the coach won't build a plan until the minimum basics are set (mirror of server/profile-gate.js;
// keep in sync). Pregnancy makes the EDD/LMP date mandatory. Each field points to where it's edited in Profile.
export interface GateField { key: string; label: string; hint: string; icon: string; pregnancyOnly?: boolean }
export const REQUIRED_FIELDS: GateField[] = [
  { key: 'sex', label: 'Sex', hint: 'so female-athlete + cycle/pregnancy coaching applies', icon: '🚻' },
  { key: 'dob', label: 'Date of birth', hint: 'drives teen / masters safety limits', icon: '🎂' },
  { key: 'mainSport', label: 'Main sport', hint: 'the coach plans for what you actually do', icon: '🏅' },
  { key: 'goal', label: 'Your goal', hint: 'build / maintain / a race — in your own words', icon: '🎯' },
  { key: 'trainingDays', label: 'Training days / week', hint: 'how many days you want to train', icon: '📅' },
  { key: 'pregnancyDate', label: 'Due date (or last period)', hint: 'sets your trimester — required while pregnant', icon: '📆', pregnancyOnly: true },
]

export function requiredProfileGaps(user: User | null | undefined): string[] {
  const info = (user?.info || {}) as Record<string, unknown>
  const s = (v: unknown) => String(v ?? '').trim()
  const goals = (info.goals || {}) as { focus?: string; notes?: string }
  const gaps: string[] = []
  if (!user || !s(user.sex)) gaps.push('sex')
  if (!s(info.dob)) gaps.push('dob')
  if (!s(info.mainSport) && !(Array.isArray(user?.sports) && user!.sports!.length > 0)) gaps.push('mainSport')
  if (!s(goals.focus) && !s(goals.notes) && !s((user as { coachProfile?: string } | undefined)?.coachProfile)) gaps.push('goal')
  if (!(Number(info.trainingDays) > 0)) gaps.push('trainingDays')
  if (info.pregnant && !s(info.dueDate) && !s(info.pregnancyStart)) gaps.push('pregnancyDate')
  return gaps
}

export const profileComplete = (user: User | null | undefined) => requiredProfileGaps(user).length === 0
