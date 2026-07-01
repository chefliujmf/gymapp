// #280 — planned-workout summary for the PRE-workout view: "what to expect" (main target + zone +
// duration) and a "structure" list (consecutive equal-target blocks merged, immediate repeats
// collapsed to N×). Pure + unit-tested (src/workout-summary.test.ts). Segments are %FTP steps.
export interface Seg { duration: number; powerStart: number; powerEnd: number }

/** Mean %FTP target of a step (flat block — no inferred ramp, mirrors SegmentProfile). */
export const segTarget = (s: Seg) => Math.round((s.powerStart + s.powerEnd) / 2)

/** Coggan power zone from %FTP. */
export function powerZone(pct: number): string {
  if (pct < 56) return 'Z1'
  if (pct < 76) return 'Z2'
  if (pct < 91) return 'Z3'
  if (pct < 106) return 'Z4'
  if (pct < 121) return 'Z5'
  if (pct < 151) return 'Z6'
  return 'Z7'
}

export interface WorkoutSummary { durationMin: number; mainPct: number; mainWatts: number | null; mainZone: string }
/** "What to expect": total duration + the main effort (highest sustained ≥2 min target). */
export function workoutSummary(segs: Seg[], ftp?: number | null): WorkoutSummary | null {
  if (!segs?.length) return null
  const durationMin = Math.round(segs.reduce((s, x) => s + x.duration, 0) / 60)
  const sustained = segs.filter((s) => s.duration >= 120)
  const pool = sustained.length ? sustained : segs
  const main = pool.reduce((a, b) => (segTarget(b) > segTarget(a) ? b : a))
  const mainPct = segTarget(main)
  return { durationMin, mainPct, mainWatts: ftp ? Math.round((mainPct / 100) * ftp) : null, mainZone: powerZone(mainPct) }
}

export interface StructureRow { label: string; count: number; durationSec: number; pct: number; zone: string; watts: number | null }
/** Structure list: merge consecutive equal-target steps, then collapse an immediately-repeated
 *  (same target + same duration) run into one "N×" row. Labels by role (warm-up / effort / etc.). */
export function structureRows(segs: Seg[], ftp?: number | null): StructureRow[] {
  if (!segs?.length) return []
  // 1) merge consecutive equal-target steps into blocks
  const blocks: { pct: number; durationSec: number }[] = []
  for (const s of segs) {
    const pct = segTarget(s)
    const last = blocks[blocks.length - 1]
    if (last && last.pct === pct) last.durationSec += s.duration
    else blocks.push({ pct, durationSec: s.duration })
  }
  // 2) collapse repeats: a 2-block cycle (effort,recovery)×N → two N× rows; else immediate (1-block) repeats.
  const same = (a?: { pct: number; durationSec: number }, b?: { pct: number; durationSec: number }) => !!a && !!b && a.pct === b.pct && a.durationSec === b.durationSec
  const rows: StructureRow[] = []
  const mk = (b: { pct: number; durationSec: number }, count: number): StructureRow => ({ label: '', count, durationSec: b.durationSec, pct: b.pct, zone: powerZone(b.pct), watts: ftp ? Math.round((b.pct / 100) * ftp) : null })
  let i = 0
  while (i < blocks.length) {
    // period-2 interval set: (blocks[i], blocks[i+1]) repeating
    if (i + 3 < blocks.length && same(blocks[i], blocks[i + 2]) && same(blocks[i + 1], blocks[i + 3])) {
      let count = 1, j = i
      while (j + 2 < blocks.length && same(blocks[j], blocks[j + 2]) && same(blocks[j + 1], blocks[j + 3])) { count++; j += 2 }
      rows.push(mk(blocks[i], count), mk(blocks[i + 1], count))
      i += count * 2
      continue
    }
    // period-1 immediate repeat
    let count = 1
    while (i + 1 < blocks.length && same(blocks[i], blocks[i + 1])) { count++; i++ }
    rows.push(mk(blocks[i], count))
    i++
  }
  // 3) role labels: first low block = Warm-up, last = Cooldown, high blocks = Effort, low mid = Recovery
  const maxPct = Math.max(...rows.map((r) => r.pct))
  rows.forEach((r, i) => {
    if (i === 0 && r.pct < 76) r.label = 'Warm-up'
    else if (i === rows.length - 1 && r.pct < 76) r.label = 'Cooldown'
    else if (r.pct >= maxPct - 5) r.label = 'Effort'
    else if (r.pct < 70) r.label = 'Recovery'
    else r.label = 'Steady'
  })
  return rows
}
