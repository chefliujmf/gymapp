// #304 — learn the athlete's real SLEEP NEED from data: over ~6 weeks, the nights they RECOVER best
// (top HRV) reveal how much sleep their body actually wants. Pure + unit-tested. Manual always wins;
// this only SUGGESTS. Until there's enough data we report how many more nights are needed.
export interface SleepDay { sleepHours: number | null; hrv: number | null; load?: number | null }
export interface SleepNeedEstimate {
  nights: number          // usable nights (sleep + HRV)
  needMore: number        // nights still needed before a confident estimate (0 = ready)
  avgSleep: number | null // average nightly sleep (h)
  suggested: number | null // learned ideal (h) — best-recovery nights, rounded to ¼ h; null until ready
  suggestedRaw: number | null // the UNrounded best-nights avg (h) — surfaced so the round target doesn't look defaulted
  topNights: number       // how many best-recovery nights were averaged
  trainOften: boolean     // high average training load (needs more sleep)
}
const MIN_NIGHTS = 21
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const r1 = (n: number) => Math.round(n * 10) / 10
const rq = (n: number) => Math.round(n * 4) / 4 // nearest 0.25 h

export function estimateSleepNeed(wellness: SleepDay[]): SleepNeedEstimate {
  const days = (wellness || []).filter((d) => d.sleepHours != null && d.sleepHours > 2 && d.sleepHours < 14 && d.hrv != null && d.hrv > 0)
  const nights = days.length
  const avgSleep = nights ? r1(avg(days.map((d) => d.sleepHours as number))) : null
  const trainOften = nights > 0 && avg(days.map((d) => Number(d.load) || 0)) >= 40
  if (nights < MIN_NIGHTS) return { nights, needMore: MIN_NIGHTS - nights, avgSleep, suggested: null, suggestedRaw: null, topNights: 0, trainOften }
  // best-recovery third of nights → the sleep the body wanted
  const top = [...days].sort((a, b) => (b.hrv as number) - (a.hrv as number)).slice(0, Math.max(4, Math.round(nights / 3)))
  const rawTop = avg(top.map((d) => d.sleepHours as number))
  return { nights, needMore: 0, avgSleep, suggested: rq(rawTop), suggestedRaw: r1(rawTop), topNights: top.length, trainOften }
}
