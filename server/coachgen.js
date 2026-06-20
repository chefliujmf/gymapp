// Coach-generation quality pass. Applied server-side ONLY to coach-API-created gym
// workouts (the MCP / AI coaches) — not manual UI edits — so every coach benefits
// deterministically and idempotently:
//   1. unilateral moves (Pallof press, single-arm/leg, split squat, …) are expanded
//      into explicit left + right entries when no side is already named;
//   2. the main set is grouped by equipment (stable) to cut equipment swaps;
//   3. a warm-up and cool-down are added when the coach didn't include any.
// Re-running on an already-normalised plan is a no-op (sides/warm/cool detected).

const SIDE_RE = /\b(left|right|each side|per side|both sides|alternating|alt\.?|l\/r|l & r)\b/i
const UNILATERAL_RE = /\b(pallof|single[- ]?arm|one[- ]?arm|single[- ]?leg|one[- ]?leg|split squat|bulgarian|side plank|suitcase|copenhagen|staggered|b[- ]?stance|single[- ]?side)\b/i
const WARMUP_RE = /\b(warm[- ]?up|warmup|mobilit|activation|dynamic (stretch|warm)|prep drill)\b/i
const COOLDOWN_RE = /\b(cool[- ]?down|cooldown|stretch|foam roll|decompress|mobility flow)\b/i

export const isWarmup = (name = '') => WARMUP_RE.test(name)
export const isCooldown = (name = '') => COOLDOWN_RE.test(name)

// Expand a recognised unilateral exercise into (left)/(right) when no side is named.
function expandUnilateral(exercises) {
  const out = []
  for (const ex of exercises) {
    const name = ex.name || ''
    if (UNILATERAL_RE.test(name) && !SIDE_RE.test(name)) {
      out.push({ ...ex, name: `${name} (left)` })
      out.push({ ...ex, name: `${name} (right)` })
    } else out.push(ex)
  }
  return out
}

// Stable group-by-equipment: groups appear in order of first use; items keep their
// relative order within a group. Unknown-equipment items sort last but stay stable.
function groupByEquipment(exercises, equipOf) {
  const order = []
  const groups = new Map()
  for (const ex of exercises) {
    const key = equipOf(ex) || '~unknown'
    if (!groups.has(key)) { groups.set(key, []); order.push(key) }
    groups.get(key).push(ex)
  }
  order.sort((a, b) => (a === '~unknown') - (b === '~unknown')) // unknowns last, else first-seen
  return order.flatMap((k) => groups.get(k))
}

const WARMUP = { name: 'Warm-up: easy cardio + dynamic mobility', mode: 'timed', seconds: 300, rest: 0 }
const COOLDOWN = { name: 'Cool-down: full-body stretch', mode: 'timed', seconds: 180, rest: 0 }

/**
 * @param exercises coach-provided exercises
 * @param equipOf   (ex) => equipment string | undefined  (catalog lookup)
 */
export function normalizeGymExercises(exercises, equipOf = () => undefined) {
  if (!Array.isArray(exercises) || !exercises.length) return exercises
  const list = expandUnilateral(exercises)
  const warm = list.filter((e) => isWarmup(e.name))
  const cool = list.filter((e) => isCooldown(e.name))
  const main = groupByEquipment(list.filter((e) => !isWarmup(e.name) && !isCooldown(e.name)), equipOf)
  return [
    ...(warm.length ? warm : [WARMUP]),
    ...main,
    ...(cool.length ? cool : [COOLDOWN]),
  ]
}
