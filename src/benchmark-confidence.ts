// #374 — confidence / learning model for the "Your benchmarks" cards. Pure + unit-tested
// (src/benchmark-confidence.test.ts) so the visual bar on every stat is derived from real facts,
// not hand-set. Each stat maps its compute state → {pct, cls, label}: a % for the bar width, a
// visual class (learn=blue→green while learning, strong=green when trusted, need=amber when a max
// effort is required) and a one-line label. See mockups/benchmark-cards.html for the intent.

import type { Vo2Confidence } from './vo2max-submax'

export type ConfClass = 'learn' | 'strong' | 'need'
export interface Confidence { pct: number; cls: ConfClass; label: string }

const clampPct = (n: number): number => Math.min(100, Math.max(8, Math.round(n)))
const conf = (pct: number, cls: ConfClass, label: string): Confidence => ({ pct: clampPct(pct), cls, label })

// Shorten a long gate sentence to a compact "Learning · <trigger>" the card can show under the bar.
function learningLabel(gate: string | undefined, fallback: string): string {
  if (!gate) return fallback
  const g = gate.trim()
  // The gates read like "after your next hard ~5-min bike effort …" — turn into "Learning · a hard 5-min effort".
  if (/5-?min/i.test(g)) return 'Learning · a hard 5-min effort'
  if (/5\s*[–-]\s*20\s*min/i.test(g)) return 'Learning · a hard ride'
  if (/all-?out/i.test(g)) return 'Learning · a max effort'
  if (/run/i.test(g)) return 'Learning · a few more runs'
  if (/night/i.test(g)) return 'Learning · a few more nights'
  return fallback
}

export interface Vo2Inputs { value: number | null; confidence?: Vo2Confidence; gate?: string }
export interface FtpInputs { eftp: number | null; manual?: number | null }
export interface PaceInputs { paceEst: number | null; runsRecent: number | null }
export interface MaxHrInputs { computed: number | null; from: string }
export interface SleepInputs { est: number | null; needMore: number | null }

export function vo2maxConfidence({ value, confidence, gate }: Vo2Inputs): Confidence {
  if (value != null) {
    if (confidence === 'high') return conf(95, 'strong', 'Strong')
    if (confidence === 'medium') return conf(68, 'learn', 'Good confidence')
    return conf(45, 'learn', 'Rough estimate') // low / unknown
  }
  return conf(35, 'learn', learningLabel(gate, 'Learning · a hard 5-min effort'))
}

// #5007 — eFTP confidence isn't binary. intervals only refreshes eFTP off a hard near-max effort, so it lags
// your true FTP between hard rides. When you've SET an FTP you actually train by and it materially disagrees
// with the computed eFTP (>5%), the estimate is NOT confidently your FTP — don't claim "Strong". Say the two
// differ and let the "Sharpen it" callout point at the fix (a hard ride refreshes eFTP). Symmetric: a big gap
// either way (stale eFTP, or an aspirational set value) means we can't be sure the computed number is your FTP.
export function ftpConfidence({ eftp, manual }: FtpInputs): Confidence {
  if (eftp == null) return conf(30, 'learn', 'Learning · needs a hard ride')
  if (manual != null && manual > 0 && Math.abs(eftp - manual) / manual > 0.05) return conf(55, 'learn', 'Differs from your set FTP')
  return conf(90, 'strong', 'Strong')
}

export function thresholdPaceConfidence({ paceEst, runsRecent }: PaceInputs): Confidence {
  if (paceEst != null) return conf(88, 'strong', 'Strong')
  if (runsRecent != null) return conf(Math.min(90, Math.round((runsRecent / 4) * 100)), 'learn', `Learning · ${runsRecent} / 4 runs`)
  return conf(25, 'learn', 'Learning · needs runs')
}

export function maxHrConfidence({ computed, from }: MaxHrInputs): Confidence {
  if (computed != null && from === 'observed') return conf(90, 'strong', 'Observed peak')
  if (computed != null) return conf(50, 'need', 'Needs a max effort') // intervals ceiling only
  return conf(40, 'need', 'Needs a max effort')
}

// #401 — TTE trust rises with how LONG you've actually held threshold. A short TTE means your curve barely
// reaches threshold (you haven't done a long threshold effort, or the threshold is set high) → keep learning.
export interface TteInputs { tte: number | null; estimated?: boolean }
export function tteConfidence({ tte, estimated }: TteInputs): Confidence {
  if (tte == null) return conf(30, 'need', 'Needs a threshold effort')
  if (estimated) return conf(52, 'learn', 'Estimated · confirm with a threshold effort') // model (CP/CS), no real hold yet
  if (tte >= 1800) return conf(90, 'strong', 'Strong') // observed ≥30 min at threshold
  if (tte >= 900) return conf(68, 'learn', 'Learning · a longer threshold effort') // 15–30 min
  return conf(45, 'learn', 'Learning · a longer threshold effort') // < 15 min
}

// #403 — CP/W′ (and running CS/D′) come from the SAME power-duration model fit intervals maintains; trust
// tracks the model's r² (fit quality) and whether it's present. Curve-derived, no manual test needed.
export interface ModelInputs { value: number | null; r2?: number | null }
export function modelFitConfidence({ value, r2 }: ModelInputs): Confidence {
  if (value == null) return conf(30, 'learn', 'Learning · needs a few hard efforts')
  if (r2 != null && r2 >= 0.99) return conf(92, 'strong', 'Strong fit')
  if (r2 != null && r2 >= 0.95) return conf(72, 'learn', 'Good fit')
  return conf(55, 'learn', 'Modeled · add efforts to firm up')
}
// #403 — Efficiency Factor: trust grows with the number of comparable aerobic rides in the trend.
export interface EfInputs { latest: number | null; samples: number }
export function efConfidence({ latest, samples }: EfInputs): Confidence {
  if (latest == null || samples < 1) return conf(28, 'learn', 'Learning · needs steady aerobic rides')
  if (samples >= 6) return conf(88, 'strong', 'Strong trend')
  return conf(Math.min(85, 30 + samples * 10), 'learn', `Learning · ${samples} / 6 rides`)
}

export function sleepNeedConfidence({ est, needMore }: SleepInputs): Confidence {
  if (est != null && !needMore) return conf(90, 'strong', 'Dialed in')
  if (est != null || needMore != null) {
    const seen = 21 - (needMore || 0)
    return conf(((21 - (needMore || 0)) / 21) * 100, 'learn', `Learning · ${seen} / 21 nights`)
  }
  return conf(20, 'learn', 'Learning · 21 nights')
}
