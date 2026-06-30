// #249 — coach-voice insights for the Wellness page. Plain-language, written for an ADULT (not ELI5):
// what each trend MEANS physiologically + a tip. Pure + unit-tested (src/wellness-insights.test.ts).
export interface Insight { metric: string; emoji: string; text: string; tip?: string }

const clean = (a: (number | null)[]) => a.filter((v): v is number => v != null)
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
// recent-half vs older-half delta (needs ≥4 points)
const trend = (a: (number | null)[]) => { const v = clean(a); if (v.length < 4) return 0; const h = Math.floor(v.length / 2); return mean(v.slice(h)) - mean(v.slice(0, h)) }

export function wellnessInsights(d: { sleep: (number | null)[]; hrv: (number | null)[]; rhr: (number | null)[]; weight: (number | null)[]; sleepNeed?: number }): Insight[] {
  const out: Insight[] = []
  const sl = clean(d.sleep)
  if (sl.length) {
    const a = mean(sl), need = d.sleepNeed && d.sleepNeed > 0 ? d.sleepNeed : 8, def = need - a
    out.push(def > 0.5
      ? { metric: 'Sleep', emoji: '😴', text: `You're averaging ${a.toFixed(1)} h vs your ~${need} h need — a ~${def.toFixed(1)} h nightly shortfall accrues as sleep debt, which blunts recovery, hormones and training adaptation.`, tip: 'Anchor a consistent bedtime + a 30-min wind-down; even +30 min/night compounds.' }
      : { metric: 'Sleep', emoji: '😴', text: `Averaging ${a.toFixed(1)} h, at or above your ~${need} h need — solid. Most physical adaptation happens during sleep.`, tip: 'Protect it especially the night before and after hard sessions.' })
  }
  const hv = clean(d.hrv)
  if (hv.length >= 4) {
    const t = trend(d.hrv)
    out.push(t > 1
      ? { metric: 'HRV', emoji: '💓', text: `HRV is trending up — your parasympathetic ("rest & recover") system is handling the load well; a good sign you're adapting.` }
      : t < -1
        ? { metric: 'HRV', emoji: '💓', text: `HRV is trending down — typically accumulating fatigue, stress or under-recovery suppressing your recovery signal.`, tip: 'Add an easy day or extra sleep; if it keeps dropping, cut intensity for a few days.' }
        : { metric: 'HRV', emoji: '💓', text: `HRV is steady around your norm — load and recovery are balanced.` })
  }
  const rh = clean(d.rhr)
  if (rh.length >= 4) {
    const t = trend(d.rhr)
    out.push(t > 1.5
      ? { metric: 'Resting HR', emoji: '❤️', text: `Resting HR is creeping up vs your baseline — often fatigue, poor sleep, or an oncoming illness.`, tip: 'Cross-check with HRV/sleep; a multi-day rise means take a recovery day.' }
      : t < -1.5
        ? { metric: 'Resting HR', emoji: '❤️', text: `Resting HR is dropping — usually a sign your aerobic fitness is improving.` }
        : { metric: 'Resting HR', emoji: '❤️', text: `Resting HR is steady — no red flags.` })
  }
  const wt = clean(d.weight)
  if (wt.length >= 4) {
    const t = trend(d.weight)
    out.push(Math.abs(t) < 0.4
      ? { metric: 'Weight', emoji: '⚖️', text: `Weight is stable over the window.` }
      : { metric: 'Weight', emoji: '⚖️', text: `Weight is trending ${t > 0 ? 'up' : 'down'} ~${Math.abs(t).toFixed(1)} kg across the window — make sure it matches your goal & fuelling.` })
  }
  return out
}
