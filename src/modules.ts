// #198 — sports as show/hide MODULES. ONE helper every UI surface reads (nav hubs, Stats cards,
// Add sheet, Fitness) so toggling a sport in Profile flips ALL of it consistently — no surface
// rolls its own sport logic, no half-gated screens. Keep CONTENT adaptive, structure stable.

export const MODULES = ['cycling', 'running', 'strength', 'yoga', 'pilates', 'meditation'] as const
export type Module = (typeof MODULES)[number]

// Endurance sports — Form/CTL/ATL come from these. Triathlon implies cycling + running.
export const ENDURANCE = ['cycling', 'running', 'triathlon']
const EXPAND: Record<string, string[]> = { triathlon: ['cycling', 'running'] }

/**
 * Canonical set of modules the athlete does, with derived umbrellas:
 *  • triathlon → cycling + running
 *  • any of yoga/pilates/meditation → also 'mind'
 *  • cycling or running → also 'endurance'
 */
export function userModules(sports: string[] = []): Set<string> {
  const set = new Set<string>()
  for (const s of sports) for (const m of EXPAND[s] || [s]) set.add(m)
  if (['yoga', 'pilates', 'meditation'].some((m) => set.has(m))) set.add('mind')
  if (set.has('cycling') || set.has('running')) set.add('endurance')
  return set
}

/**
 * Does the athlete do this module? With no sports selected yet we DEFAULT TO SHOWN
 * (`emptyShowsAll`, true by default) so a not-yet-onboarded user isn't shown an empty app.
 * Pass `{ emptyShowsAll: false }` for "is this MINE" semantics (e.g. ordering, per-sport cards).
 */
export function hasModule(sports: string[] = [], module: string, opts: { emptyShowsAll?: boolean } = {}): boolean {
  const { emptyShowsAll = true } = opts
  if (!sports || !sports.length) return emptyShowsAll
  return userModules(sports).has(module)
}
