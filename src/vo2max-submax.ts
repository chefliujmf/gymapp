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
export function runningVo2max({ vdot, hrMax, hrRest, runsRecent }: { vdot?: number | null; hrMax?: number | null; hrRest?: number | null; runsRecent?: number | null }): Vo2Estimate | null {
  // #337 — a VDOT off almost no running is meaningless (JM: "I barely run"). If we know the recent run
  // count and it's thin (<4), DON'T offer a running VO₂max at all — let the sport they actually train win.
  if (runsRecent != null && runsRecent < 4) return null
  const hr = hrRatioVo2max(hrMax, hrRest)
  if (vdot) {
    const diverges = hr != null && Math.abs(vdot - hr) > 6 // HRmax likely assumed / stale → trust pace, flag it
    return { value: round1(vdot), source: 'your running pace (VDOT)', confidence: diverges ? 'low' : 'medium' }
  }
  if (hr) return { value: hr, source: 'your max & resting HR', confidence: 'low' }
  return null
}

/** Cycling VO₂max. #337 — the `10.8 × W/kg + 7` (Storer/Hawley) formula is for MAXIMAL AEROBIC POWER
 *  (MAP ≈ your best 5–6-min power), NOT FTP. Feeding it raw FTP under-reads badly (a 235 W / 76 kg
 *  rider → 40, when Coros says 50). So: use **5-min max power** when we have it (accurate); else scale
 *  FTP up to an estimated MAP (FTP ≈ 0.82·MAP → MAP ≈ FTP × 1.22) so the estimate isn't artificially low. */
export function cyclingVo2max({ ftp, weightKg, hrMax, hrRest, map5min }: { ftp?: number | null; weightKg?: number | null; hrMax?: number | null; hrRest?: number | null; map5min?: number | null }): Vo2Estimate | null {
  if (weightKg && weightKg > 0) {
    if (map5min && map5min > 0) return { value: round1(10.8 * map5min / weightKg + 7), source: 'your 5-min max power', confidence: 'medium' }
    if (ftp && ftp > 0) return { value: round1(10.8 * (ftp * 1.22) / weightKg + 7), source: 'your FTP (→ est. MAP)', confidence: 'low' }
  }
  const hr = hrRatioVo2max(hrMax, hrRest)
  if (hr) return { value: round1(hr * 0.95), source: 'your max & resting HR', confidence: 'low' }
  return null
}

/** Headline VO₂max for the global card. #327 — it must reflect the sport the athlete ACTUALLY does:
 *  a cyclist's number comes from cycling, a runner's from running. So `perSport` MUST be ordered by
 *  the athlete's own sports (primary first); we take the primary sport's estimate, NOT the biggest
 *  number across sports (which used to pick an inflated off-sport HR-ratio). Manual value always wins. */
export function headlineVo2max(manual: number | null | undefined, perSport: { sport: string; est: Vo2Estimate | null }[]): { value: number; sport: string; source: string; confidence: Vo2Confidence } | null {
  if (manual) return { value: round1(manual), sport: '', source: 'you set it', confidence: 'high' }
  const valid = perSport.filter((p): p is { sport: string; est: Vo2Estimate } => !!p.est)
  if (!valid.length) return null
  const best = valid[0] // caller ordered by the athlete's sports → primary sport wins
  return { value: best.est.value, sport: best.sport, source: best.est.source, confidence: best.est.confidence }
}

export const confLabel = (c: Vo2Confidence) => (c === 'high' ? 'measured' : c === 'medium' ? 'estimated' : 'rough estimate')
