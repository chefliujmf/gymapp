import type { User } from './auth/api'

// #A (audit #743/#748) — the coach won't build a plan until the minimum basics are set (mirror of server/profile-gate.js;
// keep in sync). Each field points to where it's edited in Profile via `section` (deep-link to the exact spot, #742).
// #759/#760 — a private/medical field (the pregnancy date) is NEVER a gate: a pregnant user is never blocked, she gets
// the safe envelope by default and the date is an optional fine-tune. So the gate = only the 5 non-sensitive basics.
export interface GateField { key: string; label: string; hint: string; icon: string; section?: string }
export const REQUIRED_FIELDS: GateField[] = [
  { key: 'sex', label: 'Sex', hint: 'so female-athlete + cycle/pregnancy coaching applies', icon: '🚻', section: 'ob-about' },
  { key: 'dob', label: 'Date of birth', hint: 'drives teen / masters safety limits', icon: '🎂', section: 'ob-about' },
  { key: 'mainSport', label: 'Main sport', hint: 'the coach plans for what you actually do', icon: '🏅', section: 'ob-sport' },
  { key: 'goal', label: 'Your goal', hint: 'build / maintain / a race — in your own words', icon: '🎯', section: 'ob-coach' },
  { key: 'trainingDays', label: 'Training days / week', hint: 'how many days you want to train', icon: '📅', section: 'ob-avail' },
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
  // #759 — pregnancy date is intentionally NOT gated (consent). Do not re-add it here.
  return gaps
}

export const profileComplete = (user: User | null | undefined) => requiredProfileGaps(user).length === 0
