// What's MISSING that blocks a feature, and what setting it UNLOCKS. Pure + unit-tested
// (src/dataGaps.test.ts). Turns silent dead-ends ("VO₂max —") into an actionable to-do so the
// user knows they're one field away, instead of thinking the feature is broken/absent. #(data-gaps)
import type { User } from './auth/api'

export interface DataGap { key: string; label: string; unlocks: string; hint: string }

export function dataGaps(u?: User | null): DataGap[] {
  if (!u) return []
  const g: DataGap[] = []
  const sports = u.sports || []
  const isCyclist = sports.includes('cycling')
  const isRunner = sports.includes('running')
  const endurance = isCyclist || isRunner

  if (!u.hasIcuKey) g.push({ key: 'intervals', label: 'Connect intervals.icu', unlocks: 'readiness, HRV / sleep / resting-HR, auto FTP & pace, and your training history', hint: 'Profile → Connect intervals.icu' })

  const hasFtp = !!(u.ftp || u.sportSettings?.cycling?.ftp)
  if (isCyclist && !hasFtp) g.push({ key: 'ftp', label: 'Set your FTP', unlocks: 'power zones, watt targets & cycling VO₂max', hint: 'Profile → FTP' })

  const hasPace = !!(u.runThresholdPace || u.sportSettings?.running?.thresholdPace)
  if (isRunner && !hasPace) g.push({ key: 'thresholdPace', label: 'Set your threshold pace', unlocks: 'run pace zones, VDOT & race predictions', hint: 'Profile → Threshold pace' })

  if (endurance && !u.maxHR) g.push({ key: 'maxHr', label: 'Set your max HR', unlocks: 'heart-rate zones & a VO₂max estimate from your HR', hint: 'Profile → Max HR' })

  if (!u.sleepNeed) g.push({ key: 'sleepNeed', label: 'Set your sleep need', unlocks: 'a personal sleep score in readiness (vs a generic 8 h)', hint: 'Profile → Sleep need' })

  return g
}
