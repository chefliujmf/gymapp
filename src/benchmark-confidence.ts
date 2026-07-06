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
export interface FtpInputs { eftp: number | null }
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

export function ftpConfidence({ eftp }: FtpInputs): Confidence {
  return eftp != null ? conf(90, 'strong', 'Strong') : conf(30, 'learn', 'Learning · needs a hard ride')
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

export function sleepNeedConfidence({ est, needMore }: SleepInputs): Confidence {
  if (est != null && !needMore) return conf(90, 'strong', 'Dialed in')
  if (est != null || needMore != null) {
    const seen = 21 - (needMore || 0)
    return conf(((21 - (needMore || 0)) / 21) * 100, 'learn', `Learning · ${seen} / 21 nights`)
  }
  return conf(20, 'learn', 'Learning · 21 nights')
}
