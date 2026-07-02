// #234 — submaximal / passive VO₂max estimates (no max effort), PER SPORT, with a source + confidence
// so we can learn & validate over time. Pure + unit-tested (src/vo2max-submax.test.ts).
//
// Methods:
//  • HR-ratio (Uth et al. 2004): VO₂max ≈ 15.3 × HRmax/HRrest — sport-agnostic central capacity, zero effort.
//  • Running: VDOT from threshold pace (running-specific) — we take the higher of VDOT and HR-ratio so a
//    conservatively-set threshold pace doesn't under-rate the engine.
//  • Cycling: Coggan 10.8·eFTP/kg + 7; HR-ratio ×0.95 fallback (cycling reads a touch lower than running).
//  • Manual / a field test always wins (high confidence).

export type Vo2Confidence = 'high' | 'medium' | 'low'
export interface Vo2Estimate { value: number; source: string; confidence: Vo2Confidence }
const round1 = (n: number) => Math.round(n * 10) / 10

/** Heart-rate-ratio VO₂max (submaximal, no effort). null if HRs missing/invalid. */
export function hrRatioVo2max(hrMax?: number | null, hrRest?: number | null): number | null {
  if (!hrMax || !hrRest || hrMax <= hrRest) return null
  return round1(15.3 * hrMax / hrRest)
}

/** Running VO₂max. #327 — VDOT (from real run PACE) is the trustworthy runner estimate; the HR-ratio
 *  method inflates when HRmax is ASSUMED (220−age), so it must NOT win (the old Math.max biased high →
 *  an unbelievable 52 for a 6:45/km runner). Prefer VDOT; if HR-ratio diverges a lot, the VDOT is only
 *  low-confidence (thin/uncertain data), never the higher HR number. */
export function runningVo2max({ vdot, hrMax, hrRest }: { vdot?: number | null; hrMax?: number | null; hrRest?: number | null }): Vo2Estimate | null {
  const hr = hrRatioVo2max(hrMax, hrRest)
  if (vdot) {
    const diverges = hr != null && Math.abs(vdot - hr) > 6 // HRmax likely assumed / stale → trust pace, flag it
    return { value: round1(vdot), source: 'your running pace (VDOT)', confidence: diverges ? 'low' : 'medium' }
  }
  if (hr) return { value: hr, source: 'your max & resting HR', confidence: 'low' }
  return null
}

/** Cycling VO₂max — Coggan from eFTP÷weight; HR-ratio ×0.95 fallback. */
export function cyclingVo2max({ ftp, weightKg, hrMax, hrRest }: { ftp?: number | null; weightKg?: number | null; hrMax?: number | null; hrRest?: number | null }): Vo2Estimate | null {
  if (ftp && weightKg && weightKg > 0) return { value: round1(10.8 * ftp / weightKg + 7), source: 'your power ÷ weight', confidence: 'low' }
  const hr = hrRatioVo2max(hrMax, hrRest)
  if (hr) return { value: round1(hr * 0.95), source: 'your max & resting HR', confidence: 'low' }
  return null
}

const RANK: Record<Vo2Confidence, number> = { high: 3, medium: 2, low: 1 }

/** Headline VO₂max for the global card: a manual value (high) wins; else the best per-sport estimate
 *  (highest confidence, then highest value). Returns the value + which sport + source/confidence. */
export function headlineVo2max(manual: number | null | undefined, perSport: { sport: string; est: Vo2Estimate | null }[]): { value: number; sport: string; source: string; confidence: Vo2Confidence } | null {
  if (manual) return { value: round1(manual), sport: '', source: 'you set it', confidence: 'high' }
  const valid = perSport.filter((p): p is { sport: string; est: Vo2Estimate } => !!p.est)
  if (!valid.length) return null
  const best = valid.sort((a, b) => RANK[b.est.confidence] - RANK[a.est.confidence] || b.est.value - a.est.value)[0]
  return { value: best.est.value, sport: best.sport, source: best.est.source, confidence: best.est.confidence }
}

export const confLabel = (c: Vo2Confidence) => (c === 'high' ? 'measured' : c === 'medium' ? 'estimated' : 'rough estimate')
