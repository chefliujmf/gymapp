// #768 — POST-WORKOUT INSIGHT ENGINE. Turns a completed activity's streams + the athlete's OWN benchmarks + recent
// history into REAL, value-adding reads — not restatements of the on-screen stat. Pure + unit-tested; the UI
// (ActivityDetail / gym view) renders a headline "session read" card (B) + a rich read under each chart (A).
//
// Covers EVERY activity type (JM: "apply the concept to all activities"): ride (power), run (pace), swim (pace/CSS),
// gym (load/volume/RPE — no streams). Each read leans on established analytics: aerobic DECOUPLING (Pw:HR / Pace:HR
// drift = durability), EFFICIENCY FACTOR + its trend (is fitness moving?), TIME-IN-ZONE quality, PACING split (fade
// vs hold), and BENCHMARK % (hard/easy for THEM). Everything degrades gracefully when a signal is missing.

export interface ChartRead { emoji: string; title: string; detail: string }
export interface Chip { value: string; label: string; dir?: 'up' | 'down' | 'flat' }
export interface Zone { key: string; pct: number; color: string }
export interface SessionInsights {
  headline: { title: string; detail: string } | null
  chips: Chip[]
  perChart: Record<string, ChartRead>
  zones?: Zone[] // for the power/pace time-in-zone bar
}

type Num = number | null | undefined
const nums = (a: Num[] | undefined): number[] => (a || []).filter((x): x is number => x != null && !Number.isNaN(Number(x))).map(Number)
const mean = (a: number[]): number => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const round = (x: number, d = 0): number => { const p = Math.pow(10, d); return Math.round(x * p) / p }
const clampPct = (x: number): number => Math.max(0, Math.min(100, x))

// ── Core analytics (sport-agnostic maths) ───────────────────────────────────

// Aerobic DECOUPLING: how much the effort:HR ratio drifts from the 1st half to the 2nd. `effort` is power (ride) or
// speed m/s (run/swim — higher = harder, same direction as power). Low drift (<5%) = a well-developed aerobic base
// holding form; high drift = fading. Returns a percentage (can be negative = got MORE efficient), or null if too short.
export function decouplingPct(effort: Num[], hr: Num[]): number | null {
  const e = (effort || []).map((x) => (x == null ? null : Number(x)))
  const h = (hr || []).map((x) => (x == null ? null : Number(x)))
  const n = Math.min(e.length, h.length)
  if (n < 120) return null // need a few minutes of paired data
  const half = Math.floor(n / 2)
  const ratio = (from: number, to: number): number | null => {
    const es: number[] = [], hs: number[] = []
    for (let i = from; i < to; i++) { if (e[i] != null && h[i] != null && (h[i] as number) > 0) { es.push(e[i] as number); hs.push(h[i] as number) } }
    if (es.length < 30) return null
    const em = mean(es), hm = mean(hs)
    return hm > 0 ? em / hm : null
  }
  const r1 = ratio(0, half), r2 = ratio(half, n)
  if (r1 == null || r2 == null || r1 === 0) return null
  return round(((r1 - r2) / r1) * 100, 1) // positive = 2nd half less efficient (drifted)
}

// EFFICIENCY FACTOR — normalized effort per heartbeat (ride: NP/HR, run/swim: speed/HR). Rising EF over weeks = the
// aerobic engine improving (more output per beat). Returns the raw EF (unit depends on sport) or null.
export function efFactor(normEffort: Num, avgHr: Num): number | null {
  const e = Number(normEffort), h = Number(avgHr)
  if (!e || !h || Number.isNaN(e) || Number.isNaN(h)) return null
  return round(e / h, 3)
}

// PACING split: 2nd-half average vs 1st-half, as a signed %. Near 0 = even; negative = negative-split (finished
// stronger); positive = faded. Works on power OR speed (same direction).
export function splitPct(series: Num[]): number | null {
  const v = (series || []).map((x) => (x == null ? null : Number(x)))
  const n = v.length
  if (n < 120) return null
  const half = Math.floor(n / 2)
  const a = nums(v.slice(0, half)), b = nums(v.slice(half))
  if (a.length < 30 || b.length < 30) return null
  const am = mean(a), bm = mean(b)
  return am > 0 ? round(((bm - am) / am) * 100, 1) : null
}

// TIME-IN-ZONE: share of samples in each zone, given a %-of-threshold → zone-index fn. Returns counts→pcts.
export function zoneShare(series: Num[], threshold: number, zoneIdx: (pctOfThreshold: number) => number, nZones = 6): number[] {
  const z = new Array(nZones).fill(0)
  let total = 0
  for (const raw of series || []) { if (raw == null || threshold <= 0) continue; const v = Number(raw); if (Number.isNaN(v)) continue; const i = Math.max(0, Math.min(nZones - 1, zoneIdx((v / threshold) * 100))); z[i]++; total++ }
  return total > 0 ? z.map((c) => clampPct((c / total) * 100)) : z
}

// ── Presentation helpers ────────────────────────────────────────────────────
const trendChip = (cur: number, base: number | null | undefined, label: string, fmt: (n: number) => string): Chip => {
  if (base == null || base <= 0) return { value: fmt(cur), label }
  const dp = round(((cur - base) / base) * 100, 0)
  const dir: Chip['dir'] = dp >= 2 ? 'up' : dp <= -2 ? 'down' : 'flat'
  return { value: `${fmt(cur)}${dp !== 0 ? ` ${dp > 0 ? '↑' : '↓'}${Math.abs(dp)}%` : ''}`, label, dir }
}
const decoupleWord = (d: number): string => d <= 3 ? 'barely drifted' : d <= 5 ? 'held well' : d <= 8 ? 'drifted moderately' : 'faded'
const decoupleQuality = (d: number): string => d <= 5 ? 'a well-developed aerobic base' : d <= 8 ? 'room to build durability' : 'the effort or heat outran the base'
const splitWord = (s: number): string => s <= -2 ? 'a negative split — you finished stronger' : Math.abs(s) < 2 ? 'even pacing, no fade' : s <= 5 ? 'a slight fade late' : 'a notable fade in the back half'

// ── RIDE ────────────────────────────────────────────────────────────────────
export function rideInsights(o: { streams: { watts?: Num[]; heartrate?: Num[]; altitude?: Num[]; cadence?: Num[] }; np?: Num; avgHr?: Num; maxHr?: Num; vi?: Num; ftp: number; elevGain?: Num; efBaseline?: number | null }): SessionInsights {
  const { streams, ftp } = o
  const watts = streams.watts || [], hr = streams.heartrate || []
  const np = Number(o.np) || round(mean(nums(watts)))
  const avgHr = Number(o.avgHr) || round(mean(nums(hr)))
  const perChart: Record<string, ChartRead> = {}
  const chips: Chip[] = []
  const zoneIdx = (p: number) => (p < 60 ? 0 : p < 76 ? 1 : p < 91 ? 2 : p < 106 ? 3 : p < 121 ? 4 : 5)
  const share = ftp > 0 ? zoneShare(watts, ftp, zoneIdx) : []
  const pctFtp = ftp > 0 && np ? round((np / ftp) * 100) : null
  const decouple = decouplingPct(watts, hr)
  const ef = efFactor(np, avgHr)
  const split = splitPct(watts)
  const dominant = share.length ? share.indexOf(Math.max(...share)) : -1
  const ZN = ['recovery', 'endurance (Z2)', 'tempo', 'threshold', 'VO₂', 'anaerobic']

  // POWER read: zone discipline + pacing + benchmark
  if (nums(watts).length > 1) {
    const domPct = dominant >= 0 ? round(share[dominant]) : 0
    const bits: string[] = []
    if (pctFtp != null) bits.push(`averaged ${pctFtp}% of your FTP`)
    if (split != null) bits.push(splitWord(split))
    perChart.watts = {
      emoji: dominant <= 1 ? '🎯' : dominant >= 3 ? '🔥' : '⚙️',
      title: dominant >= 0 ? `${domPct}% of the ride in ${ZN[dominant]}${dominant <= 1 && domPct >= 75 ? ' — textbook discipline' : ''}` : 'Power holds the story',
      detail: `${bits.join(', ')}${bits.length ? '.' : ''}${o.vi && Number(o.vi) >= 1.15 ? ` Variable effort (VI ${Number(o.vi).toFixed(2)}) — lots of surges.` : ''}`.trim(),
    }
    if (pctFtp != null) chips.push({ value: `${pctFtp}%`, label: 'of FTP' })
    if (dominant >= 0) chips.push({ value: `${domPct}%`, label: `in ${ZN[dominant].replace(' (Z2)', '')}` })
  }
  // HR read: decoupling + EF trend
  if (nums(hr).length > 1) {
    if (decouple != null && ef != null) {
      perChart.heartrate = {
        emoji: decouple <= 5 ? '💪' : '📈',
        title: `HR ${decoupleWord(decouple)} — ${decoupleQuality(decouple)}`,
        detail: `Power:HR decoupling ${decouple > 0 ? decouple : Math.abs(decouple)}% over the ride${decouple <= 5 ? ' (under 5% = strong).' : '.'} Efficiency ${ef}${o.efBaseline ? ` — ${round(((ef - o.efBaseline) / o.efBaseline) * 100) >= 0 ? 'up' : 'down'} ${Math.abs(round(((ef - o.efBaseline) / o.efBaseline) * 100))}% vs your recent rides` : ''}.`,
      }
      chips.push({ value: `${decouple}%`, label: 'HR decoupling' })
      chips.push(trendChip(ef, o.efBaseline, 'efficiency', (n) => n.toFixed(2)))
    } else {
      const mx = Number(o.maxHr) || round(Math.max(...nums(hr)))
      perChart.heartrate = { emoji: '❤️', title: `Averaged ${avgHr} bpm, peaked ${mx}`, detail: `Effort sat at ${round((avgHr / (mx || avgHr)) * 100)}% of your session max.` }
    }
  }
  if (o.elevGain && Number(o.elevGain) > 150) perChart.altitude = { emoji: '⛰️', title: `${round(Number(o.elevGain))} m climbed`, detail: Number(o.elevGain) > 400 ? 'Punchy terrain — hard to hold clean power blocks.' : 'Rolling terrain shaped the power.' }
  if (nums(streams.cadence || []).length > 1) { const c = round(mean(nums(streams.cadence))); perChart.cadence = { emoji: '🔄', title: `${c} rpm average`, detail: c < 85 ? 'Grindy cadence — bigger gear, watch the knees on climbs.' : c > 95 ? 'Spinning light and fast — easy on the joints.' : 'Comfortable, efficient cadence range.' } }

  // HEADLINE (B): the single most important read of the session
  const headline = buildHeadline({ pctFtp, dominant, decouple, ef, efBaseline: o.efBaseline, split, sport: 'ride', domPct: dominant >= 0 ? round(share[dominant]) : 0 })
  const zones: Zone[] | undefined = share.length ? share.map((pct, i) => ({ key: ['z1', 'z2', 'z3', 'z4', 'z5', 'z6'][i], pct: round(pct), color: ['#5a6472', '#34e07d', '#ffb13d', '#ff8a3d', '#ff5d6c', '#c026d3'][i] })).filter((z) => z.pct >= 0.5) : undefined
  return { headline, chips: chips.slice(0, 3), perChart, zones }
}

// ── RUN ───────────────────────────────────────────────────────────────────── speed = m/s (from velocity_smooth)
export function runInsights(o: { streams: { velocity_smooth?: Num[]; heartrate?: Num[]; altitude?: Num[]; cadence?: Num[] }; avgHr?: Num; maxHr?: Num; thresholdPaceSecPerKm?: number | null; elevGain?: Num; efBaseline?: number | null; avgSpeedMps?: number | null }): SessionInsights {
  const { streams } = o
  const speed = (streams.velocity_smooth || []).map((v) => (v == null ? null : Number(v)))
  const hr = streams.heartrate || []
  const avgHr = Number(o.avgHr) || round(mean(nums(hr)))
  const avgSpeed = o.avgSpeedMps || mean(nums(speed))
  const perChart: Record<string, ChartRead> = {}
  const chips: Chip[] = []
  // threshold pace → threshold SPEED (m/s). zone by % of threshold speed.
  const thrSpeed = o.thresholdPaceSecPerKm && o.thresholdPaceSecPerKm > 0 ? 1000 / o.thresholdPaceSecPerKm : 0
  const zoneIdx = (p: number) => (p < 76 ? 0 : p < 88 ? 1 : p < 95 ? 2 : p < 100 ? 3 : p < 105 ? 4 : 5) // % of threshold speed → E/M/T/…
  const share = thrSpeed > 0 ? zoneShare(speed, thrSpeed, zoneIdx) : []
  const pctThr = thrSpeed > 0 && avgSpeed ? round((avgSpeed / thrSpeed) * 100) : null
  const decouple = decouplingPct(speed, hr)
  const ef = efFactor(avgSpeed ? avgSpeed * 100 : null, avgHr) // scale speed so EF reads on a friendly range
  const split = splitPct(speed)
  const dominant = share.length ? share.indexOf(Math.max(...share)) : -1
  const ZN = ['easy', 'steady', 'tempo', 'threshold', 'interval', 'rep']

  if (nums(speed).length > 1) {
    const bits: string[] = []
    if (pctThr != null) bits.push(`ran at ${pctThr}% of your threshold pace`)
    if (split != null) bits.push(splitWord(split))
    const domPct = dominant >= 0 ? round(share[dominant]) : 0
    perChart.pace = {
      emoji: dominant === 0 ? '🎯' : dominant >= 3 ? '🔥' : '👟',
      title: dominant >= 0 ? `${domPct}% of the run at ${ZN[dominant]} pace${dominant === 0 && domPct >= 75 ? ' — disciplined easy' : ''}` : 'Pace holds the story',
      detail: `${bits.join(', ')}${bits.length ? '.' : ''}`.trim(),
    }
    if (pctThr != null) chips.push({ value: `${pctThr}%`, label: 'of threshold' })
    if (dominant >= 0) chips.push({ value: `${domPct}%`, label: ZN[dominant] })
  }
  if (nums(hr).length > 1) {
    if (decouple != null) {
      perChart.heartrate = {
        emoji: decouple <= 5 ? '💪' : '📈',
        title: `HR ${decoupleWord(decouple)} — ${decoupleQuality(decouple)}`,
        detail: `Pace:HR decoupling ${decouple > 0 ? decouple : Math.abs(decouple)}% ${decouple <= 5 ? '(under 5% = strong durability).' : 'late in the run.'}${ef != null && o.efBaseline ? ` Efficiency ${round(((ef - o.efBaseline) / o.efBaseline) * 100) >= 0 ? 'up' : 'down'} ${Math.abs(round(((ef - o.efBaseline) / o.efBaseline) * 100))}% vs recent.` : ''}`,
      }
      chips.push({ value: `${decouple}%`, label: 'HR decoupling' })
    } else { const mx = Number(o.maxHr) || round(Math.max(...nums(hr))); perChart.heartrate = { emoji: '❤️', title: `Averaged ${avgHr} bpm, peaked ${mx}`, detail: `Effort at ${round((avgHr / (mx || avgHr)) * 100)}% of session max.` } }
  }
  if (nums(streams.cadence || []).length > 1) { const c = round(mean(nums(streams.cadence)) * 2); perChart.cadence = { emoji: '🦶', title: `${c} spm cadence`, detail: c < 165 ? 'Lower cadence — a touch more ground-contact; quick, light steps reduce impact.' : c > 185 ? 'Very quick turnover.' : 'Efficient turnover in the 170–185 sweet spot.' } }
  if (o.elevGain && Number(o.elevGain) > 100) perChart.altitude = { emoji: '⛰️', title: `${round(Number(o.elevGain))} m of climbing`, detail: 'Hills lift HR for the same pace — judge the effort by feel, not the watch pace.' }

  const headline = buildHeadline({ pctFtp: pctThr, dominant, decouple, ef, efBaseline: o.efBaseline, split, sport: 'run', domPct: dominant >= 0 ? round(share[dominant]) : 0 })
  const zones: Zone[] | undefined = share.length ? share.map((pct, i) => ({ key: ['z1', 'z2', 'z3', 'z4', 'z5', 'z6'][i], pct: round(pct), color: ['#5a6472', '#34e07d', '#ffb13d', '#ff8a3d', '#ff5d6c', '#c026d3'][i] })).filter((z) => z.pct >= 0.5) : undefined
  return { headline, chips: chips.slice(0, 3), perChart, zones }
}

// ── SWIM ──────────────────────────────────────────────────────────────────── speed m/s; CSS threshold; SWOLF
export function swimInsights(o: { streams: { velocity_smooth?: Num[]; heartrate?: Num[]; cadence?: Num[] }; avgHr?: Num; cssPaceSecPer100?: number | null; swolf?: Num; avgSpeedMps?: number | null }): SessionInsights {
  const { streams } = o
  const speed = (streams.velocity_smooth || []).map((v) => (v == null ? null : Number(v)))
  const avgSpeed = o.avgSpeedMps || mean(nums(speed))
  const perChart: Record<string, ChartRead> = {}
  const chips: Chip[] = []
  const cssSpeed = o.cssPaceSecPer100 && o.cssPaceSecPer100 > 0 ? 100 / o.cssPaceSecPer100 : 0
  const pctCss = cssSpeed > 0 && avgSpeed ? round((avgSpeed / cssSpeed) * 100) : null
  const split = splitPct(speed)
  if (nums(speed).length > 1 || pctCss != null) {
    perChart.pace = {
      emoji: pctCss != null && pctCss < 90 ? '🎯' : '🏊',
      title: pctCss != null ? `Held ${pctCss}% of your CSS pace` : 'Steady swim pace',
      detail: `${pctCss != null ? (pctCss < 90 ? 'Comfortable aerobic swimming' : pctCss < 100 ? 'Right around threshold' : 'At or above race pace') : ''}${split != null ? `${pctCss != null ? '; ' : ''}${splitWord(split)}` : ''}.`.trim(),
    }
    if (pctCss != null) chips.push({ value: `${pctCss}%`, label: 'of CSS' })
  }
  if (o.swolf && Number(o.swolf) > 0) { chips.push({ value: `${round(Number(o.swolf))}`, label: 'SWOLF' }); perChart.cadence = { emoji: '🌊', title: `SWOLF ${round(Number(o.swolf))} — stroke efficiency`, detail: 'Strokes + seconds per length; lower means you cover more water per stroke. Track it drifting down over weeks.' } }
  if (nums(streams.heartrate || []).length > 1) { const avgHr = Number(o.avgHr) || round(mean(nums(streams.heartrate))); perChart.heartrate = { emoji: '❤️', title: `Averaged ${avgHr} bpm`, detail: 'Swim HR reads lower than land — the horizontal position + water pressure. Judge effort by pace + feel.' } }
  const headline: SessionInsights['headline'] = pctCss != null
    ? { title: pctCss < 90 ? 'A controlled aerobic swim 🏊' : pctCss < 100 ? 'A solid threshold swim 🎯' : 'A fast, race-pace swim 🔥', detail: `You held ${pctCss}% of your CSS${o.swolf ? `, SWOLF ${round(Number(o.swolf))}` : ''}${split != null ? `, with ${splitWord(split)}` : ''}. ${pctCss < 90 ? 'Good base-building work.' : 'Quality speed work.'}` }
    : null
  return { headline, chips: chips.slice(0, 3), perChart }
}

// ── GYM ─────────────────────────────────────────────────────────────────────  no streams — load / volume / RPE / PRs
export interface GymSet { name?: string; reps?: Num; sets?: Num; weight?: Num; section?: string }
export function gymInsights(o: { exercises?: GymSet[]; rpe?: Num; feel?: string; title?: string; tonnageBaseline?: number | null; durationMin?: Num }): SessionInsights {
  const ex = (o.exercises || []).filter((e) => e && (e.section === 'main' || !e.section))
  const perChart: Record<string, ChartRead> = {}
  const chips: Chip[] = []
  // total tonnage (load moved) = Σ sets×reps×weight, when weights are logged
  let tonnage = 0, workingSets = 0, loaded = 0
  for (const e of ex) { const s = Number(e.sets) || 1, r = Number(e.reps) || 0, w = Number(e.weight) || 0; if (r > 0) workingSets += s; if (w > 0 && r > 0) { tonnage += s * r * w; loaded++ } }
  const rpe = Number(o.rpe) || 0
  if (workingSets > 0) {
    perChart.volume = {
      emoji: '🏋️',
      title: `${workingSets} working sets across ${ex.length} lifts`,
      detail: tonnage > 0 ? `You moved ${round(tonnage).toLocaleString()} kg of total volume${o.tonnageBaseline ? ` — ${tonnage >= o.tonnageBaseline ? 'up' : 'down'} ${Math.abs(round(((tonnage - o.tonnageBaseline) / o.tonnageBaseline) * 100))}% vs your recent sessions` : ''}. Progressive overload is the driver — nudge load or reps when it feels repeatable.` : 'Log the loads to track total volume + progressive overload over time.',
    }
    if (tonnage > 0) chips.push(trendChip(round(tonnage), o.tonnageBaseline, 'volume kg', (n) => n.toLocaleString()))
    chips.push({ value: `${workingSets}`, label: 'working sets' })
  }
  if (rpe > 0) {
    chips.push({ value: `${rpe}/10`, label: 'effort (RPE)' })
    perChart.rpe = {
      emoji: rpe >= 8 ? '🔥' : rpe >= 5 ? '💪' : '🟢',
      title: `Effort ${rpe}/10 — ${rpe >= 8 ? 'took it near the limit' : rpe >= 5 ? 'solid, controlled work' : 'a lighter, quality-focused day'}`,
      detail: rpe >= 9 ? 'Leaving little in reserve — make sure the next hard session is well spaced.' : rpe >= 5 ? 'Good stimulus with reps in reserve — the sweet spot for building.' : 'Technique + freshness over grind today; nothing wrong with that.',
    }
  }
  const headline: SessionInsights['headline'] = workingSets > 0
    ? { title: rpe >= 8 ? 'A hard, high-quality lift 🔥' : 'Solid strength work banked 💪', detail: `${workingSets} working sets${tonnage > 0 ? `, ${round(tonnage).toLocaleString()} kg moved` : ''}${rpe > 0 ? `, RPE ${rpe}/10` : ''}. ${o.tonnageBaseline && tonnage > o.tonnageBaseline ? 'Volume trending up — the overload is working.' : 'Consistency + progressive load is what moves strength.'}` }
    : null
  return { headline, chips: chips.slice(0, 3), perChart }
}

// shared headline builder for endurance (ride/run)
function buildHeadline(o: { pctFtp: number | null; dominant: number; decouple: number | null; ef: number | null; efBaseline?: number | null; split: number | null; sport: string; domPct: number }): SessionInsights['headline'] {
  const durable = o.decouple != null && o.decouple <= 5
  const efUp = o.ef != null && o.efBaseline != null && o.efBaseline > 0 && ((o.ef - o.efBaseline) / o.efBaseline) * 100 >= 2
  const easy = o.dominant <= 1
  let title: string
  if (durable && efUp) title = 'A clean aerobic session — and your durability is trending up 💪'
  else if (o.dominant >= 3) title = 'A genuine quality session — you spent real time up high 🔥'
  else if (easy && o.domPct >= 75) title = 'Textbook discipline — you kept it in the right zone 🎯'
  else if (durable) title = 'Strong aerobic control — HR stayed hitched to the effort 💪'
  else title = 'Session logged — here is what the numbers say'
  const parts: string[] = []
  if (o.pctFtp != null) parts.push(`${o.pctFtp}% of ${o.sport === 'run' ? 'threshold pace' : 'FTP'}`)
  if (o.decouple != null) parts.push(`${o.decouple}% ${o.sport === 'run' ? 'pace' : 'power'}:HR drift`)
  if (efUp) parts.push('rising efficiency')
  if (o.split != null && Math.abs(o.split) < 2) parts.push('even pacing')
  else if (o.split != null && o.split <= -2) parts.push('a negative split')
  return { title, detail: parts.length ? `${parts.join(' · ')}. ${durable ? 'The base is absorbing the work.' : easy ? 'Right dose for an easy day.' : 'Good stimulus banked.'}` : 'Detailed reads under each chart below.' }
}
