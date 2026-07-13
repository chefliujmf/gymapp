// #5007 — HONEST benchmark estimates. Every stat blends its independent sources into one best estimate and
// derives a confidence from FOUR real signals, so a stale intervals eFTP can't read "Strong 240" when your CP
// says 248. Pure + unit-tested (src/benchmark-estimate.test.ts). Design: mockup mockups/benchmark-confidence.html
// (JM picked A+C: a why-line by default, tap → the source breakdown).
//
// The four signals:
//   ① recency        — how fresh is the effort behind a source (eFTP decays between hard rides)
//   ② agreement      — do the independent sources agree (tight % spread → trust)
//   ③ test-backed    — a real near-max / threshold hold beats a pure model extrapolation
//   ④ fit / sample   — model r² and how many efforts back it
//
// Units are native per metric (W, sec/km pace, bpm, kJ, m, sec). All math is %-relative so it works for pace
// (lower = better) as well as power. Never claim "Strong" unless a recent effort actually backs the number.

export type EstClass = 'strong' | 'good' | 'learn' | 'need'
export interface EstConfidence { pct: number; cls: EstClass; label: string }

export type SourceKind = 'test' | 'observed' | 'model' | 'derived' | 'manual'
export interface Src {
  name: string              // human label, e.g. 'intervals eFTP', 'from CP'
  value: number | null      // native unit; null = source unavailable
  ageDays?: number | null   // how old the backing effort is (undefined/null = unknown age)
  kind: SourceKind
}
// #506 — 'low'/'high' = a source that IS available but reads meaningfully below/above the number in use (so the
// card can say "reads lower" honestly instead of rubber-stamping everything "agrees"). 'off' = genuinely missing.
export type SrcTag = 'primary' | 'agrees' | 'low' | 'high' | 'stale' | 'off'
export interface TaggedSrc { name: string; value: number | null; tag: SrcTag }
export interface Estimate {
  best: number | null
  lo: number | null
  hi: number | null
  conf: EstConfidence
  why: string
  sources: TaggedSrc[]
}

const clampPct = (n: number): number => Math.min(100, Math.max(8, Math.round(n)))

// how much a source counts, from its kind and freshness (fresh window is metric-specific)
export function sourceWeight(s: Src, freshDays: number): number {
  const base = s.kind === 'test' ? 1 : s.kind === 'observed' ? 0.95 : s.kind === 'derived' ? 0.82 : s.kind === 'model' ? 0.75 : 0.6 // manual
  const fresh = s.ageDays == null ? 0.7 : s.ageDays <= freshDays ? 1 : s.ageDays <= freshDays * 2 ? 0.5 : 0.28
  return base * fresh
}

const isStale = (s: Src, freshDays: number): boolean => s.ageDays != null && s.ageDays > freshDays

export interface EstimateOpts {
  freshDays: number         // fresh window for this metric (e.g. FTP ~21d, MaxHR ~90d)
  fitR2?: number | null     // for model-derived metrics (CP/W′/CS/D′)
  sampleN?: number | null   // number of efforts behind the model
  tol?: number              // agreement tolerance as a fraction of best (default 0.03)
}

// The shared engine: weighted blend → best + range, then a 4-signal confidence.
export function honestEstimate(sources: Src[], opts: EstimateOpts): Omit<Estimate, 'why' | 'sources'> & { spread: number; freshTest: boolean; stale: Src[] } {
  const valid = sources.filter((s): s is Src & { value: number } => s.value != null && Number.isFinite(s.value))
  if (!valid.length) return { best: null, lo: null, hi: null, spread: 1, freshTest: false, stale: [], conf: { pct: 25, cls: 'learn', label: 'Learning' } }

  const weights = valid.map((s) => sourceWeight(s, opts.freshDays))
  const wsum = weights.reduce((a, b) => a + b, 0)
  const best = wsum > 0 ? valid.reduce((a, s, i) => a + s.value * weights[i], 0) / wsum : valid[0].value
  const vals = valid.map((s) => s.value)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const spread = best ? Math.abs(hi - lo) / Math.abs(best) : 1

  // ③ test-backed: a fresh test/observed effort
  const freshTest = valid.some((s) => (s.kind === 'test' || s.kind === 'observed') && !isStale(s, opts.freshDays) && s.ageDays != null)
  const anyFresh = valid.some((s) => s.ageDays == null || !isStale(s, opts.freshDays))
  const stale = valid.filter((s) => isStale(s, opts.freshDays))

  // base by strongest available evidence
  let pct = freshTest ? 90 : valid.some((s) => s.kind === 'model' || s.kind === 'derived') ? 64 : 48
  // ② agreement: dock once spread passes the tolerance
  const tol = opts.tol ?? 0.03
  if (spread > tol) pct -= Math.min(38, (spread - tol) * 380)
  // ① recency: nothing fresh at all
  if (!anyFresh) pct -= 16
  // ④ fit + sample (model metrics)
  if (opts.fitR2 != null) pct += opts.fitR2 >= 0.99 ? 6 : opts.fitR2 >= 0.95 ? 0 : -12
  if (opts.sampleN != null && opts.sampleN < 3) pct -= (3 - opts.sampleN) * 7

  pct = clampPct(pct)
  const cls: EstClass = pct >= 82 ? 'strong' : pct >= 64 ? 'good' : pct >= 46 ? 'learn' : 'need'
  const label = cls === 'strong' ? 'Strong' : cls === 'good' ? 'Good confidence' : cls === 'need' ? 'Needs a hard effort' : 'Estimate'
  return { best, lo, hi, spread, freshTest, stale, conf: { pct, cls, label } }
}

// tag each source relative to the blended best (primary = closest fresh, stale = old, off = missing/way-off)
function tagSources(sources: Src[], best: number | null, freshDays: number, tol: number): TaggedSrc[] {
  return sources.map((s) => {
    if (s.value == null) return { name: s.name, value: null, tag: 'off' as SrcTag }
    if (isStale(s, freshDays)) return { name: s.name, value: s.value, tag: 'stale' as SrcTag }
    if (best != null && Math.abs(s.value - best) / Math.abs(best) > tol * 2.5) return { name: s.name, value: s.value, tag: (s.value < best ? 'low' : 'high') as SrcTag } // available but disagrees — say which way, don't hide it as "off"
    return { name: s.name, value: s.value, tag: 'agrees' as SrcTag }
  })
}

// #497 — infer FTP from the SUBMAXIMAL HR–power relationship (Friel's HR-power / efficiency approach, docs/
// beyond-ftp-metrics.md). Fit watts = a + b·HR from steady (power, HR) points and extrapolate to threshold HR (a
// share of max HR). This lets an athlete who's only ridden EASY get a real FTP read — 200 W @ 110 bpm (max 185 =
// 59%) ⇒ FTP well above 200, not 200. HONEST band: the true HR-power curve FLATTENS near threshold so a straight
// line slightly OVER-reads (we shade the point down the further we extrapolate), and the threshold-HR share itself
// varies per athlete (~0.85–0.91 of max) — that's the dominant spread. Needs ≥2 points across a real HR range.
export interface HrPowerPoint { watts: number; hr: number }
export interface HrPowerFtp { best: number; lo: number; hi: number; r2: number; n: number; extrapBpm: number }
export function ftpFromHrPower(points: HrPowerPoint[], maxHr: number | null | undefined): HrPowerFtp | null {
  const pts = (points || []).filter((p) => p && p.watts > 0 && p.hr > 0)
  if (pts.length < 2 || !maxHr || maxHr < 120) return null
  const n = pts.length
  const mHr = pts.reduce((s, p) => s + p.hr, 0) / n
  const mW = pts.reduce((s, p) => s + p.watts, 0) / n
  let sHrW = 0, sHrHr = 0, sWW = 0
  for (const p of pts) { const dh = p.hr - mHr, dw = p.watts - mW; sHrW += dh * dw; sHrHr += dh * dh; sWW += dw * dw }
  if (sHrHr <= 0) return null // all points at ~one HR → no slope to fit (need a range of intensities)
  const slope = sHrW / sHrHr // watts per bpm
  if (slope <= 0) return null // power must rise with HR for this to mean anything
  const intercept = mW - slope * mHr
  const r2 = sWW > 0 ? (sHrW * sHrW) / (sHrHr * sWW) : 0
  const at = (pct: number) => intercept + slope * (maxHr * pct) // extrapolated watts at a threshold-HR share
  const hrHi = Math.max(...pts.map((p) => p.hr))
  const extrapBpm = Math.max(0, maxHr * 0.88 - hrHi) // bpm we project past the data's top point
  const curve = Math.min(0.06, (extrapBpm / (maxHr * 0.10)) * 0.05) // linear over-reads near threshold → shade down
  return { best: Math.round(at(0.88) * (1 - curve)), lo: Math.round(at(0.85) * (1 - curve)), hi: Math.round(at(0.91)), r2, n, extrapBpm }
}

// #497 running analog of ftpFromHrPower — infer THRESHOLD PACE from the HR cost of steady/easy runs when there's
// no recent hard test. Regress pace (sec/km) on HR and extrapolate to threshold HR (~0.88·maxHr). Pace FALLS as HR
// rises (negative slope); linear extrapolation over-reads speed near threshold (the pace–HR curve flattens), so we
// shade the projected pace conservatively SLOWER. Returns null unless there's a real HR range and a sane slope.
export interface HrPacePoint { paceSecKm: number; hr: number }
export interface HrPaceThreshold { best: number; lo: number; hi: number; r2: number; n: number; extrapBpm: number }
export function thresholdPaceFromHrPace(points: HrPacePoint[], maxHr: number | null | undefined): HrPaceThreshold | null {
  const pts = (points || []).filter((p) => p && p.paceSecKm > 120 && p.paceSecKm < 900 && p.hr > 0)
  if (pts.length < 2 || !maxHr || maxHr < 120) return null
  const n = pts.length
  const mHr = pts.reduce((s, p) => s + p.hr, 0) / n
  const mP = pts.reduce((s, p) => s + p.paceSecKm, 0) / n
  let sHrP = 0, sHrHr = 0, sPP = 0
  for (const p of pts) { const dh = p.hr - mHr, dp = p.paceSecKm - mP; sHrP += dh * dp; sHrHr += dh * dh; sPP += dp * dp }
  if (sHrHr <= 0) return null // all at ~one HR → no slope to fit
  const slope = sHrP / sHrHr // sec/km per bpm
  if (slope >= 0) return null // pace must FALL (get faster) as HR rises for this to mean anything
  const intercept = mP - slope * mHr
  const r2 = sPP > 0 ? (sHrP * sHrP) / (sHrHr * sPP) : 0
  const at = (pct: number) => intercept + slope * (maxHr * pct) // extrapolated pace at a threshold-HR share
  const hrHi = Math.max(...pts.map((p) => p.hr))
  const extrapBpm = Math.max(0, maxHr * 0.88 - hrHi) // bpm projected past the data's top point
  const curve = Math.min(0.06, (extrapBpm / (maxHr * 0.10)) * 0.05) // over-reads speed near threshold → shade pace slower
  return { best: Math.round(at(0.88) * (1 + curve)), lo: Math.round(at(0.91)), hi: Math.round(at(0.85) * (1 + curve)), r2, n, extrapBpm }
}

// ---------------------------------------------------------------------------
// Per-metric assemblers — build the sources, run the engine, craft an honest why.
// ---------------------------------------------------------------------------

export interface FtpInputs {
  eftp: number | null; eftpAgeDays?: number | null   // intervals eFTP (decays between hard rides)
  cp?: number | null                                  // critical power (derived FTP ≈ CP)
  best20?: number | null                              // best recent 20-min power (FTP ≈ best20 × 0.95)
  manual?: number | null                              // the FTP the athlete trains by
  hrPower?: HrPowerPoint[]                             // #497 (power, HR) points from steady rides → HR-power FTP
  maxHr?: number | null                               // #497 needed to extrapolate the HR-power line to threshold HR
}
export function ftpEstimate(inp: FtpInputs): Estimate {
  const FRESH = 21, tol = 0.05
  const eftpFresh = inp.eftp != null && inp.eftpAgeDays != null && inp.eftpAgeDays <= FRESH
  const hrp = ftpFromHrPower(inp.hrPower || [], inp.maxHr) // #497 — submaximal HR-power FTP (great when there's no test)
  const srcRows: Src[] = [
    { name: 'you train by', value: inp.manual ?? null, ageDays: null, kind: 'manual' },
    { name: 'intervals eFTP', value: inp.eftp, ageDays: inp.eftpAgeDays ?? null, kind: 'observed' },
    { name: 'from CP', value: inp.cp != null ? Math.round(inp.cp) : null, ageDays: 0, kind: 'model' },
    { name: 'best 20-min ×0.95', value: inp.best20 != null ? Math.round(inp.best20 * 0.95) : null, ageDays: null, kind: 'test' },
    { name: 'HR vs power', value: hrp ? hrp.best : null, ageDays: null, kind: 'model' }, // #497 — from the HR cost of steady rides
  ]
  // The value you TRAIN BY anchors it — you know your FTP better than a stale eFTP or a CP fit from easy rides.
  // Computed sources only MOVE the number when a genuinely FRESH hard effort (a recently-refreshed eFTP) disagrees.
  // Easy/stale data never drags your known FTP down; it just means we can't confirm it yet.
  if (inp.manual != null && inp.manual > 0) {
    const m = inp.manual
    let best = m, conf: EstConfidence, why: string
    if (eftpFresh && Math.abs((inp.eftp as number) - m) / m > tol) {
      best = Math.round((m + (inp.eftp as number)) / 2)
      conf = { pct: 66, cls: 'good', label: 'Worth a re-test' }
      why = `A recent hard effort put your eFTP at ${inp.eftp} W but you train by ${m} — it's somewhere around ${best} W. A fresh 20–40 min test settles it.`
    } else if (eftpFresh) {
      conf = { pct: 88, cls: 'strong', label: 'Confirmed by a recent effort' }
      why = `A recent hard ride backs your ${m} W FTP — confirmed.`
    } else {
      conf = { pct: 50, cls: 'need', label: 'Unconfirmed — needs a hard effort' }
      why = `Using your set FTP of ${m} W. Your recent rides have been too easy to confirm it${inp.cp != null ? ` (your CP curve currently reads ${Math.round(inp.cp)} W)` : ''} — a hard 20–40 min effort would prove it.`
    }
    // #506 — tag each computed source by whether it ACTUALLY agrees with the value you train by (within tol), else
    // say which way it reads. The old code blind-tagged everything 'agrees', so 220 W read "agrees" next to a 260 W
    // manual (JM: "all diff numbers but agrees with the blend?"). Only the manual value is 'primary' / in use here.
    const sources: TaggedSrc[] = srcRows.map((s) => {
      if (s.kind === 'manual') return { name: s.name, value: s.value, tag: 'primary' as SrcTag }
      if (s.value == null) return { name: s.name, value: s.value, tag: 'off' as SrcTag }
      if (s.name === 'intervals eFTP' && !eftpFresh) return { name: s.name, value: s.value, tag: 'stale' as SrcTag }
      const d = (s.value - m) / m
      return { name: s.name, value: s.value, tag: (Math.abs(d) <= tol ? 'agrees' : d < 0 ? 'low' : 'high') as SrcTag }
    })
    return { best, lo: best, hi: best, conf, why, sources }
  }
  // No FTP set yet → blend the computed sources honestly (this is where eFTP/CP/20-min agreement matters).
  const comp = srcRows.filter((s) => s.kind !== 'manual')
  const e = honestEstimate(comp, { freshDays: FRESH, tol: 0.03 })
  const best = e.best != null ? Math.round(e.best) : null
  const staleE = inp.eftp != null && inp.eftpAgeDays != null && inp.eftpAgeDays > FRESH
  const why = best == null ? 'No FTP yet — set the FTP you train by, or do a hard 20–40 min effort.'
    : staleE && inp.cp != null ? `Your eFTP ${inp.eftp} W is stale and your CP reads ~${Math.round(inp.cp)} — blended ~${best} W. Set the FTP you train by, or do a hard effort to confirm.`
    : `Best estimate ~${best} W from your recent efforts — set the FTP you train by to anchor it.`
  return { best, lo: e.lo != null ? Math.round(e.lo) : null, hi: e.hi != null ? Math.round(e.hi) : null, conf: e.conf, why, sources: tagSources(comp, e.best, FRESH, 0.03) }
}

// Threshold pace (running), native = seconds per km (LOWER is faster). Same shape as FTP.
export interface ThresholdPaceInputs {
  csDerived: number | null; csAgeDays?: number | null  // from critical speed
  recentTt?: number | null; ttAgeDays?: number | null  // a recent time-trial / race threshold pace
  vdot?: number | null                                  // pace implied by best 5k (VDOT)
  manual?: number | null
  hrPace?: HrPacePoint[]                                 // #497 (pace, HR) points from steady runs → HR-pace threshold
  maxHr?: number | null                                  // #497 needed to extrapolate the HR-pace line to threshold HR
}
export function thresholdPaceEstimate(inp: ThresholdPaceInputs): Estimate {
  const FRESH = 21, tol = 0.02
  const hrp = thresholdPaceFromHrPace(inp.hrPace || [], inp.maxHr) // #497 — submaximal HR-pace threshold (great when there's no test)
  const sources: Src[] = [
    { name: 'from critical speed', value: inp.csDerived, ageDays: inp.csAgeDays ?? null, kind: 'model' },
    { name: 'recent TT / race', value: inp.recentTt ?? null, ageDays: inp.ttAgeDays ?? null, kind: 'test' },
    { name: 'VDOT (best 5k)', value: inp.vdot ?? null, ageDays: null, kind: 'derived' },
    { name: 'HR vs pace', value: hrp ? hrp.best : null, ageDays: null, kind: 'model' }, // #497 — from the HR cost of steady runs
    { name: 'you train by', value: inp.manual ?? null, ageDays: null, kind: 'manual' },
  ]
  const e = honestEstimate(sources, { freshDays: FRESH, tol })
  const best = e.best != null ? Math.round(e.best) : null
  const noTt = inp.recentTt == null
  let why: string
  if (best == null) why = 'No threshold pace yet — a hard 20-min run gives you one.'
  else if (noTt) why = `Modeled from your critical speed, with no recent hard test to check it. Best guess ~${fmtPace(best)}/km — a hard 20-min run would firm it.`
  else if (e.conf.cls === 'strong') why = `Your model and recent efforts agree near ${fmtPace(best)}/km — a dependable threshold.`
  else why = `Best estimate ~${fmtPace(best)}/km. A fresh hard run tightens the confidence.`
  return { best, lo: e.lo != null ? Math.round(e.lo) : null, hi: e.hi != null ? Math.round(e.hi) : null, conf: e.conf, why, sources: tagSources(sources, e.best, FRESH, tol) }
}

// CP / W′ / CS / D′ — a single fitted model value; trust tracks fit r², sample and recency.
export interface ModelInputs { value: number | null; r2?: number | null; sampleN?: number | null; ageDays?: number | null; unit: string; noun: string }
export function modelEstimate(inp: ModelInputs): Estimate {
  const FRESH = 28
  // the curve is fit from real hard efforts, so a fresh fit is test-backed ('observed'); r²/sample still adjust it.
  const sources: Src[] = [{ name: 'curve fit', value: inp.value, ageDays: inp.ageDays ?? null, kind: 'observed' }]
  const e = honestEstimate(sources, { freshDays: FRESH, fitR2: inp.r2, sampleN: inp.sampleN, tol: 0.02 })
  let why: string
  if (inp.value == null) why = `No ${inp.noun} yet — a few hard efforts across durations builds the curve.`
  else if (e.conf.cls === 'strong') why = `From your power-duration curve (r² ${fmtR2(inp.r2)}${inp.sampleN ? `, ${inp.sampleN} efforts` : ''}). Well supported.`
  else if ((inp.sampleN ?? 3) < 3) why = `Modeled from your curve, but only ${inp.sampleN ?? 'a few'} effort(s) back it — add efforts across durations to firm it up.`
  else why = `Modeled from your curve (r² ${fmtR2(inp.r2)}). Solid; a fresh hard effort raises confidence.`
  const round = (n: number | null) => (n == null ? null : inp.unit === 'kJ' || inp.unit === 'm' ? Math.round(n) : Math.round(n * 10) / 10)
  return { best: round(e.best), lo: round(e.lo), hi: round(e.hi), conf: e.conf, why, sources: tagSources(sources, e.best, FRESH, 0.02) }
}

// TTE — trust from an OBSERVED hold; a modeled value is a placeholder.
export interface TteInputs { observedSec?: number | null; observedAgeDays?: number | null; modeledSec?: number | null }
export function tteEstimate(inp: TteInputs): Estimate {
  const FRESH = 42
  const sources: Src[] = [
    { name: 'observed hold', value: inp.observedSec ?? null, ageDays: inp.observedAgeDays ?? null, kind: 'observed' },
    { name: 'modeled (CP/CS)', value: inp.modeledSec ?? null, ageDays: null, kind: 'model' },
  ]
  const e = honestEstimate(sources, { freshDays: FRESH, tol: 0.12 })
  const observed = inp.observedSec != null
  let why: string
  if (e.best == null) why = 'No threshold hold yet — a sustained 25–30 min effort makes TTE real.'
  else if (!observed) why = `Only modeled — you haven't held threshold long recently. A sustained 25–30 min effort confirms it.`
  else if ((inp.observedSec as number) >= 1800) why = `You've actually held ~threshold for ${fmtMin(inp.observedSec as number)} — a real read, not a model guess.`
  else why = `Held ~threshold for ${fmtMin(inp.observedSec as number)} so far; a longer effort stretches both the number and the confidence.`
  return { best: e.best != null ? Math.round(e.best) : null, lo: e.lo != null ? Math.round(e.lo) : null, hi: e.hi != null ? Math.round(e.hi) : null, conf: e.conf, why, sources: tagSources(sources, e.best, FRESH, 0.12) }
}

// #501 — age-based max HR (Tanaka 2001, `208 − 0.7·age`) — more accurate than the old `220−age`. A rough FALLBACK.
export const maxHrFromAge = (age: number | null | undefined): number | null => (typeof age === 'number' && age > 8 && age < 100 ? Math.round(208 - 0.7 * age) : null)
// Max HR — observed peak per sport beats an intervals ceiling; it ages slowly.
export interface MaxHrInputs { observed?: number | null; observedAgeDays?: number | null; ceiling?: number | null; sport?: string; age?: number | null }
export function maxHrEstimate(inp: MaxHrInputs): Estimate {
  const FRESH = 120
  const ageEst = maxHrFromAge(inp.age)
  const sources: Src[] = [
    { name: 'observed peak', value: inp.observed ?? null, ageDays: inp.observedAgeDays ?? null, kind: 'observed' },
    { name: 'intervals ceiling', value: inp.ceiling ?? null, ageDays: null, kind: 'model' },
    // #501 (JM) — the age formula is a LOW-confidence FALLBACK: include it ONLY when there's nothing observed and no
    // ceiling, so a real observed peak / zone ceiling is never dragged down by it.
    ...(inp.observed == null && inp.ceiling == null && ageEst != null ? [{ name: 'age estimate', value: ageEst, ageDays: null, kind: 'model' as const }] : []),
  ]
  const e = honestEstimate(sources, { freshDays: FRESH, tol: 0.02 })
  const sp = inp.sport ? ` (${inp.sport})` : ''
  let why: string
  if (e.best == null) why = `No max HR yet${sp} — it shows up after an all-out effort.`
  else if (inp.observed != null && inp.observedAgeDays != null && inp.observedAgeDays <= FRESH) why = `Seen ${inp.observed} bpm${sp} on a hard effort ${inp.observedAgeDays}d ago — recent and real.`
  else if (inp.observed != null) why = `Seen ${inp.observed} bpm${sp}, but a while back — a fresh all-out effort refreshes it.`
  else if (inp.ceiling == null && ageEst != null) why = `Estimated from your age (208 − 0.7 × age)${sp} — a rough starting point; an all-out effort with a strap reveals your true peak.`
  else why = `Only an intervals ceiling so far${sp} — a real all-out effort gives you a true peak.`
  return { best: e.best != null ? Math.round(e.best) : null, lo: e.lo != null ? Math.round(e.lo) : null, hi: e.hi != null ? Math.round(e.hi) : null, conf: e.conf, why, sources: tagSources(sources, e.best, FRESH, 0.02) }
}

// ---- small formatters ----
export function fmtPace(sec: number): string { const m = Math.floor(sec / 60); const s = Math.round(sec % 60); return `${m}:${String(s).padStart(2, '0')}` }
export function fmtMin(sec: number): string { const m = Math.floor(sec / 60); const s = Math.round(sec % 60); return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min` }
function fmtR2(r2?: number | null): string { return r2 == null ? '—' : (Math.round(r2 * 100) / 100).toFixed(2) }
