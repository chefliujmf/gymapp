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
export type SrcTag = 'primary' | 'agrees' | 'stale' | 'off'
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
    if (best != null && Math.abs(s.value - best) / Math.abs(best) > tol * 2.5) return { name: s.name, value: s.value, tag: 'off' as SrcTag }
    return { name: s.name, value: s.value, tag: 'agrees' as SrcTag }
  })
}

// ---------------------------------------------------------------------------
// Per-metric assemblers — build the sources, run the engine, craft an honest why.
// ---------------------------------------------------------------------------

export interface FtpInputs {
  eftp: number | null; eftpAgeDays?: number | null   // intervals eFTP (decays between hard rides)
  cp: number | null                                   // critical power (derived FTP ≈ CP)
  best20?: number | null                              // best recent 20-min power (FTP ≈ best20 × 0.95)
  manual?: number | null                              // the FTP the athlete trains by
}
export function ftpEstimate(inp: FtpInputs): Estimate {
  const FRESH = 21, tol = 0.03
  const sources: Src[] = [
    // eFTP only refreshes off a hard near-max ride, so a FRESH eFTP means a real recent effort ('observed');
    // when it's old it both loses weight and stops counting as test-backed.
    { name: 'intervals eFTP', value: inp.eftp, ageDays: inp.eftpAgeDays ?? null, kind: 'observed' },
    { name: 'from CP', value: inp.cp != null ? Math.round(inp.cp) : null, ageDays: 0, kind: 'model' },
    { name: 'best 20-min ×0.95', value: inp.best20 != null ? Math.round(inp.best20 * 0.95) : null, ageDays: null, kind: 'test' },
    { name: 'you train by', value: inp.manual ?? null, ageDays: null, kind: 'manual' },
  ]
  const e = honestEstimate(sources, { freshDays: FRESH, tol })
  const best = e.best != null ? Math.round(e.best) : null
  const staleE = sources.find((s) => s.name === 'intervals eFTP' && s.ageDays != null && s.ageDays > FRESH)
  let why: string
  if (best == null) why = 'No power estimate yet — a hard 20–40 min effort gives you an FTP.'
  else if (staleE && inp.cp != null && Math.abs((staleE.value as number) - inp.cp) / inp.cp > tol) {
    why = `Your eFTP ${staleE.value} W is stale (${staleE.ageDays}d) and your CP says ~${Math.round(inp.cp)}. Blended best guess ~${best} W — a hard 20–40 min effort would confirm it.`
  } else if (inp.manual != null && best != null && Math.abs(inp.manual - best) / best > 0.05) {
    why = `Your sources land near ${best} W, but you train by ${inp.manual} — a hard effort settles which is real.`
  } else if (e.conf.cls === 'strong') {
    why = `Your independent estimates all land near ${best} W — a trustworthy FTP.`
  } else {
    why = `Best estimate ~${best} W from your recent efforts. A fresh hard 20–40 min ride firms it up.`
  }
  return { best, lo: e.lo != null ? Math.round(e.lo) : null, hi: e.hi != null ? Math.round(e.hi) : null, conf: e.conf, why, sources: tagSources(sources, e.best, FRESH, tol) }
}

// Threshold pace (running), native = seconds per km (LOWER is faster). Same shape as FTP.
export interface ThresholdPaceInputs {
  csDerived: number | null; csAgeDays?: number | null  // from critical speed
  recentTt?: number | null; ttAgeDays?: number | null  // a recent time-trial / race threshold pace
  vdot?: number | null                                  // pace implied by best 5k (VDOT)
  manual?: number | null
}
export function thresholdPaceEstimate(inp: ThresholdPaceInputs): Estimate {
  const FRESH = 21, tol = 0.02
  const sources: Src[] = [
    { name: 'from critical speed', value: inp.csDerived, ageDays: inp.csAgeDays ?? null, kind: 'model' },
    { name: 'recent TT / race', value: inp.recentTt ?? null, ageDays: inp.ttAgeDays ?? null, kind: 'test' },
    { name: 'VDOT (best 5k)', value: inp.vdot ?? null, ageDays: null, kind: 'derived' },
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

// Max HR — observed peak per sport beats an intervals ceiling; it ages slowly.
export interface MaxHrInputs { observed?: number | null; observedAgeDays?: number | null; ceiling?: number | null; sport?: string }
export function maxHrEstimate(inp: MaxHrInputs): Estimate {
  const FRESH = 120
  const sources: Src[] = [
    { name: 'observed peak', value: inp.observed ?? null, ageDays: inp.observedAgeDays ?? null, kind: 'observed' },
    { name: 'intervals ceiling', value: inp.ceiling ?? null, ageDays: null, kind: 'model' },
  ]
  const e = honestEstimate(sources, { freshDays: FRESH, tol: 0.02 })
  const sp = inp.sport ? ` (${inp.sport})` : ''
  let why: string
  if (e.best == null) why = `No max HR yet${sp} — it shows up after an all-out effort.`
  else if (inp.observed != null && inp.observedAgeDays != null && inp.observedAgeDays <= FRESH) why = `Seen ${inp.observed} bpm${sp} on a hard effort ${inp.observedAgeDays}d ago — recent and real.`
  else if (inp.observed != null) why = `Seen ${inp.observed} bpm${sp}, but a while back — a fresh all-out effort refreshes it.`
  else why = `Only an intervals ceiling so far${sp} — a real all-out effort gives you a true peak.`
  return { best: e.best != null ? Math.round(e.best) : null, lo: e.lo != null ? Math.round(e.lo) : null, hi: e.hi != null ? Math.round(e.hi) : null, conf: e.conf, why, sources: tagSources(sources, e.best, FRESH, 0.02) }
}

// ---- small formatters ----
export function fmtPace(sec: number): string { const m = Math.floor(sec / 60); const s = Math.round(sec % 60); return `${m}:${String(s).padStart(2, '0')}` }
export function fmtMin(sec: number): string { const m = Math.floor(sec / 60); const s = Math.round(sec % 60); return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min` }
function fmtR2(r2?: number | null): string { return r2 == null ? '—' : (Math.round(r2 * 100) / 100).toFixed(2) }
