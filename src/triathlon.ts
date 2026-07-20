// #570 — Triathlon orchestration layer: a THIN synthesis that LEVERAGES the three sport engines (swim CSS · bike FTP ·
// run threshold pace) — it does NOT introduce a 4th benchmark. It answers the triathlete's real questions: which
// discipline is my LIMITER, is my training BALANCED to the race, and where do I stand. Pure + unit-tested (triathlon.test.ts).

export type RaceType = 'sprint' | 'olympic' | '70.3' | 'ironman'
export type Discipline = 'swim' | 'bike' | 'run'

// Typical TIME-share of each leg by race type (bike dominates every triathlon). Used as the "balance" target the
// athlete's training share is judged against, and to weight the limiter by how much each leg costs in the race.
export const RACE_DEMAND: Record<RaceType, Record<Discipline, number>> = {
  sprint: { swim: 16, bike: 54, run: 30 },
  olympic: { swim: 15, bike: 55, run: 30 },
  '70.3': { swim: 14, bike: 56, run: 30 },
  ironman: { swim: 12, bike: 56, run: 32 },
}
export const RACE_LABEL: Record<RaceType, string> = { sprint: 'Sprint', olympic: 'Olympic', '70.3': 'Ironman 70.3', ironman: 'Ironman' }
// leg distances (m) for the "vs the race" context.
export const RACE_LEGS: Record<RaceType, Record<Discipline, number>> = {
  sprint: { swim: 750, bike: 20000, run: 5000 },
  olympic: { swim: 1500, bike: 40000, run: 10000 },
  '70.3': { swim: 1900, bike: 90000, run: 21100 },
  ironman: { swim: 3800, bike: 180000, run: 42200 },
}

/** Pull the target race type out of the athlete's free-text goal (falls back to Olympic when unstated). */
export function parseRaceType(goalNotes?: string | null): RaceType | null {
  const t = (goalNotes || '').toLowerCase()
  if (/\bironman\b(?!.*70\.?3)|\bfull\s*(distance|iron)|140\.6/.test(t) && !/70\.?3/.test(t)) return 'ironman'
  if (/70\.?3|half\s*(iron|distance)|middle\s*distance/.test(t)) return '70.3'
  if (/\bolympic\b|standard\s*distance|\b1500\s*m/.test(t)) return 'olympic'
  if (/\bsprint\b/.test(t)) return 'sprint'
  if (/\btri(athlon|athlete)?\b|\bbrick\b/.test(t)) return 'olympic' // a tri goal with no distance → assume Olympic
  return null
}

export interface DisciplineState {
  discipline: Discipline
  hasBenchmark: boolean
  computed: boolean // benchmark is model-computed (vs manual-only)
  readiness: number // 0–100 "how dialed in / prepared" (benchmark known + trained to its race share) — NOT absolute fitness
  sharePct: number // this discipline's share of the last-28-day training load
  demandPct: number // its share of race time (the balance target)
  label: string // short status word
}

export interface TriSynthesis {
  raceType: RaceType | null
  disciplines: DisciplineState[] // swim, bike, run (in that order)
  limiter: Discipline | null // weakest link relative to the race
  loadTotal: number // 28-day swim+bike+run load
  insight: string
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Benchmark readiness: unknown=0, manual-only=60, model-computed=90. */
const benchReadiness = (has: boolean, computed: boolean) => (!has ? 0 : computed ? 90 : 60)
/** Training adequacy: your share ÷ the race's demand share, capped at 100 (train it at/above its race weight = full). */
const trainAdequacy = (sharePct: number, demandPct: number) => (demandPct <= 0 ? 0 : clamp((sharePct / demandPct) * 100, 0, 100))

/**
 * The synthesis. Inputs are already-resolved per-discipline benchmarks (CSS/FTP/threshold) + their computed-ness, plus
 * the last-28-day load per discipline. Readiness = half benchmark-known, half trained-to-race-share. The LIMITER is the
 * lowest-readiness discipline, but weighted by race demand so an under-prepared BIKE (56% of the race) outranks an
 * under-prepared SWIM (14%) at equal readiness. Honest when data is thin (no benchmark / no load → low readiness).
 */
export function triathlonSynthesis(input: {
  raceType: RaceType | null
  swim: { has: boolean; computed: boolean }
  bike: { has: boolean; computed: boolean }
  run: { has: boolean; computed: boolean }
  load: { swim: number; bike: number; run: number } // 28-day TSS/sTSS per discipline
}): TriSynthesis {
  const rt = input.raceType || 'olympic'
  const demand = RACE_DEMAND[rt]
  const loadTotal = Math.max(0, input.load.swim + input.load.bike + input.load.run)
  const share = (v: number) => (loadTotal > 0 ? Math.round((v / loadTotal) * 100) : 0)
  const build = (d: Discipline, b: { has: boolean; computed: boolean }): DisciplineState => {
    const sharePct = share(input.load[d]), demandPct = demand[d]
    // With NO training load anywhere, we can't judge balance — readiness is benchmark-only (don't unfairly zero a
    // benchmarked discipline for a training gap we can't measure). With load, blend benchmark + trained-to-race-share.
    const readiness = loadTotal > 0
      ? Math.round(0.5 * benchReadiness(b.has, b.computed) + 0.5 * trainAdequacy(sharePct, demandPct))
      : benchReadiness(b.has, b.computed)
    const label = !b.has ? 'set benchmark' : readiness >= 75 ? 'strong' : readiness >= 50 ? 'solid' : sharePct < demandPct * 0.5 ? 'under-trained' : 'building'
    return { discipline: d, hasBenchmark: b.has, computed: b.computed, readiness, sharePct, demandPct, label }
  }
  const disciplines = [build('swim', input.swim), build('bike', input.bike), build('run', input.run)]
  // limiter = the biggest weakness that MATTERS: (100 − readiness) weighted by the race demand share. Only flag a real
  // gap (weighted deficit above a floor); if all three are dialed in, no limiter.
  let limiter: Discipline | null = null, worst = 0
  for (const s of disciplines) {
    const weighted = (100 - s.readiness) * (s.demandPct / 100)
    if (weighted > worst) { worst = weighted; limiter = s.discipline }
  }
  if (worst < 8) limiter = null // everything reasonably prepared
  const insight = buildInsight(disciplines, limiter, rt)
  return { raceType: input.raceType, disciplines, limiter, loadTotal, insight }
}

const NAME: Record<Discipline, string> = { swim: 'Swimming', bike: 'the bike', run: 'the run' }
function buildInsight(ds: DisciplineState[], limiter: Discipline | null, rt: RaceType): string {
  const strong = ds.filter((d) => d.readiness >= 75).map((d) => d.discipline)
  if (!limiter) return `All three are dialed in for a ${RACE_LABEL[rt]} — keep the balance and sharpen race-specific work (bricks, pacing).`
  const lim = ds.find((d) => d.discipline === limiter)!
  const others = strong.filter((d) => d !== limiter).map((d) => (d === 'bike' ? 'the bike' : d === 'run' ? 'the run' : 'the swim'))
  const strongStr = others.length === 2 ? 'a strong cyclist and runner' : others.length === 1 ? `strong on ${others[0]}` : 'building across the board'
  if (!lim.hasBenchmark) return `You're ${strongStr}; ${NAME[limiter]} is unassessed and it's ~${lim.demandPct}% of the race. Log a couple of swims to set your CSS — it's your biggest opportunity.`
  if (lim.sharePct < lim.demandPct * 0.5) return `You're ${strongStr}; ${NAME[limiter]} is under-trained (${lim.sharePct}% of your load vs ${lim.demandPct}% of the race). Shifting some volume there is the fastest path to a better time.`
  return `${NAME[limiter][0].toUpperCase() + NAME[limiter].slice(1)} is your limiter — bring its readiness up and the whole race improves.`
}
