// #508 — the coupled Critical-Power / Critical-Speed model: the ENGINE. CP + W′ (cycling) or CS + D′ (running) define
// the WHOLE power/pace-duration curve, so every metric derives from those two parameters and stays consistent —
// change one and the dependents re-solve (JM: "change FTP or CP → the others follow"). P(t) = CP + W′/t (Monod &
// Scherrer / Coggan 2-parameter model). Pure + unit-tested (cp-model.test.ts). intervals fits CP/W′ + CS/D′ already;
// this layer makes FTP · TTE · the curve · zones a single coherent read off them, plus honest confidence.

export interface CpModel { cp: number; wPrimeKj: number } // cycling: CP in W, W′ in kJ
export interface CsModel { csPaceSecKm: number; dPrimeM: number } // running: Critical Speed as pace (sec/km), D′ in m

// ── Cycling (power) ──────────────────────────────────────────────────────────
/** Best sustainable power (W) for a duration — a point ON the curve. P(t) = CP + W′/t. */
export function powerAt(m: CpModel, sec: number): number { return Math.round(m.cp + (m.wPrimeKj * 1000) / sec) }
/** Time to exhaustion (s) at a target power — how long before the W′ battery is spent. Null at/below CP (sustainable). */
export function tteAtPower(m: CpModel, power: number): number | null { return power > m.cp ? Math.round((m.wPrimeKj * 1000) / (power - m.cp)) : null }
/** FTP from CP — the ~1-hour power sits just BELOW the CP asymptote (FTP ≈ 0.97 × CP). */
export function ftpFromCp(cp: number): number { return Math.round(cp * 0.97) }
/** CP implied by a set FTP (inverse of ftpFromCp) — used when the athlete overrides FTP and CP must stay coherent. */
export function cpFromFtp(ftp: number): number { return Math.round(ftp / 0.97) }

// ── Running (pace) ───────────────────────────────────────────────────────────
export const speedFromPace = (paceSecKm: number): number => 1000 / paceSecKm // m/s
export const paceFromSpeed = (mps: number): number => Math.round(1000 / mps)  // sec/km
/** Best sustainable pace (sec/km) for a duration — the running curve. */
export function paceAt(m: CsModel, sec: number): number { return paceFromSpeed(speedFromPace(m.csPaceSecKm) + m.dPrimeM / sec) }
/** Time to exhaustion (s) at a target pace — null if at/slower than CS (sustainable). */
export function tteAtPace(m: CsModel, paceSecKm: number): number | null {
  const v = speedFromPace(paceSecKm), cs = speedFromPace(m.csPaceSecKm)
  return v > cs ? Math.round(m.dPrimeM / (v - cs)) : null
}
/** Threshold pace from CS — the ~1-hour pace sits just SLOWER than the CS asymptote (CS overestimates MLSS ~2.5%). */
export function thresholdFromCs(csPaceSecKm: number): number { return Math.round(csPaceSecKm * 1.025) }

// ── Confidence in the model fit ──────────────────────────────────────────────
// The engine's trust in its own read: how good the curve fit is (r²), how many efforts + how SPREAD across durations
// (a fit off two 5-min efforts is weak), and recency. This is what lets a card say "Strong" honestly vs "Learning".
export interface FitInputs { r2?: number | null; effortCount?: number | null; durationSpreadMin?: number | null; ageDays?: number | null }
export interface FitConfidence { pct: number; cls: 'strong' | 'good' | 'learn' | 'need'; label: string }
export function fitConfidence(inp: FitInputs): FitConfidence {
  const r2 = inp.r2 ?? 0.9, n = inp.effortCount ?? 0, spread = inp.durationSpreadMin ?? 0, age = inp.ageDays ?? 0
  let pct = 40
  pct += Math.min(30, Math.max(0, (r2 - 0.9) / 0.1 * 30)) // r² 0.90→0.98+ adds up to 30
  pct += Math.min(18, n * 3)                               // more efforts
  pct += Math.min(12, spread / 10)                         // efforts spread across durations (min)
  if (age > 42) pct -= 15                                  // stale
  pct = Math.max(20, Math.min(95, Math.round(pct)))
  const cls = pct >= 82 ? 'strong' : pct >= 64 ? 'good' : pct >= 46 ? 'learn' : 'need'
  const label = cls === 'strong' ? 'Strong' : cls === 'good' ? 'Good fit' : cls === 'learn' ? 'Learning' : 'Needs efforts'
  return { pct, cls, label }
}
