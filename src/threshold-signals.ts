// #508 — the multi-signal threshold ENGINE's physiological signals. These don't invent a threshold from easy
// riding (physics won't allow it) — they CONFIRM or FLAG a candidate threshold from how the body responded, so the
// fused estimate (benchmark-estimate.honestEstimate) carries real confidence instead of a lone power-curve number.
// All pure + unit-tested (threshold-signals.test.ts). Signals sourced from intervals: per-ride `decoupling`
// (Pw:Hr aerobic drift %) + `icu_efficiency_factor`; per-night `hrv`.

export interface RideSignal { np: number; hr: number; decoupling: number; durationMin: number; ef?: number | null }

// ── Cardiac drift / Pw:Hr decoupling ─────────────────────────────────────────
// Friel: aerobic decoupling < ~5% over a steady effort = aerobically sustainable AT that intensity. So if the athlete
// has ridden NEAR a candidate FTP and drift stayed low, that FTP is CONFIRMED sustainable; if near-FTP rides drift
// high (HR climbing at that power), the FTP is set too high. Endurance-only riding (well below FTP) can't confirm it.
export type DecouplingVerdict = 'confirms' | 'too-high' | 'thin'
export interface DecouplingCheck { verdict: DecouplingVerdict; nearN: number; avgDrift: number | null; note: string }
export function decouplingCheck(rides: RideSignal[], ftp: number | null | undefined): DecouplingCheck {
  if (!ftp || ftp <= 0) return { verdict: 'thin', nearN: 0, avgDrift: null, note: 'set an FTP to check it against your rides' }
  // "near threshold" = a real steady effort (≥30 min) with normalized power within 88–102% of the candidate FTP
  const near = (rides || []).filter((r) => r && r.np > 0 && r.durationMin >= 30 && r.np >= ftp * 0.88 && r.np <= ftp * 1.02)
  if (near.length < 2) return { verdict: 'thin', nearN: near.length, avgDrift: null, note: `not enough riding near ${ftp} W to confirm it — one steady effort there would` }
  const avgDrift = Math.round((near.reduce((s, r) => s + r.decoupling, 0) / near.length) * 10) / 10
  if (avgDrift <= 5) return { verdict: 'confirms', nearN: near.length, avgDrift, note: `your rides near ${ftp} W hold steady (${avgDrift}% HR drift) — it's sustainable` }
  return { verdict: 'too-high', nearN: near.length, avgDrift, note: `your HR drifts ${avgDrift}% at ~${ftp} W — above a sustainable threshold, so ${ftp} W looks high` }
}

// ── Next-day recovery (HRV response) ─────────────────────────────────────────
// A session AT/below threshold is recoverable — HRV rebounds by the next morning; a session ABOVE it suppresses HRV.
// Given a hard ride's intensity-factor (NP/FTP) and the HRV change the next morning vs the athlete's baseline, tell
// whether that intensity was recoverable. Used to flag an FTP that's set so high that "threshold" rides wreck HRV.
export type RecoveryVerdict = 'recovered' | 'suppressed' | 'thin'
export interface RecoveryCheck { verdict: RecoveryVerdict; note: string }
export function recoveryCheck(intensityFactor: number | null | undefined, nextDayHrvPctVsBaseline: number | null | undefined): RecoveryCheck {
  if (intensityFactor == null || nextDayHrvPctVsBaseline == null) return { verdict: 'thin', note: 'needs a hard ride + next-morning HRV to read recovery' }
  // only informative for genuinely hard rides (IF ≥ 0.85); a big HRV drop (> ~8% below baseline) = not recovered
  if (intensityFactor < 0.85) return { verdict: 'thin', note: 'that ride was too easy to test recovery at threshold' }
  if (nextDayHrvPctVsBaseline <= -8) return { verdict: 'suppressed', note: `your HRV dropped ${Math.abs(Math.round(nextDayHrvPctVsBaseline))}% after a hard effort — that intensity is above what you currently absorb` }
  return { verdict: 'recovered', note: 'your HRV bounced back after a hard effort — that intensity is sustainable' }
}

// ── Efficiency factor trend ──────────────────────────────────────────────────
// EF (NP ÷ avg HR) rising over time at similar intensity = the aerobic engine improving; falling = fatigue/decline.
// Context for the threshold estimate (a rising EF supports nudging the number up), not a threshold value itself.
export interface EfTrend { pctChange: number | null; direction: 'up' | 'flat' | 'down' | 'thin'; note: string }
export function efTrend(efValuesOldToNew: (number | null | undefined)[]): EfTrend {
  const v = (efValuesOldToNew || []).filter((x): x is number => typeof x === 'number' && x > 0)
  if (v.length < 4) return { pctChange: null, direction: 'thin', note: 'log a few more rides to read your efficiency trend' }
  const half = Math.floor(v.length / 2)
  const early = v.slice(0, half).reduce((s, x) => s + x, 0) / half
  const late = v.slice(half).reduce((s, x) => s + x, 0) / (v.length - half)
  const pctChange = Math.round(((late - early) / early) * 1000) / 10
  const direction = pctChange >= 2 ? 'up' : pctChange <= -2 ? 'down' : 'flat'
  const note = direction === 'up' ? `efficiency +${pctChange}% — your aerobic engine is improving` : direction === 'down' ? `efficiency ${pctChange}% — watch for fatigue` : 'efficiency steady'
  return { pctChange, direction, note }
}
