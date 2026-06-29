// Pure mapping between intervals.icu `sportSettings[]` and Platyplus per-sport stats.
// Unit-tested in src/sport-settings.test.ts. #210 two-way sync.
//
// intervals stores per-sport-group settings in an array; each entry has `types:[...]`
// (the activity types it covers) plus ftp / lthr / max_hr / threshold_pace / pace_units.
// `threshold_pace` is in METRES PER SECOND. We expose running as sec/km and swimming as
// sec/100m for the UI, and convert on the boundary. VO₂max is NOT an intervals field —
// it stays Platyplus-only and never touches sportSettings.

// canonical Platyplus group ← which intervals activity `types` belong to it
export const GROUP_TYPES = {
  cycling: ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'Velomobile'],
  running: ['Run', 'VirtualRun', 'TrailRun'],
  swimming: ['Swim', 'OpenWaterSwim'],
}

// intervals threshold_pace (m/s) → our per-group pace number (running sec/km, swim sec/100m)
export function paceFromMps(group, mps) {
  if (!(mps > 0)) return null
  if (group === 'running') return Math.round(1000 / mps) // sec/km
  if (group === 'swimming') return Math.round(100 / mps) // sec/100m
  return null
}
// our pace number → intervals threshold_pace (m/s)
export function mpsFromPace(group, pace) {
  if (!(pace > 0)) return null
  if (group === 'running') return 1000 / pace
  if (group === 'swimming') return 100 / pace
  return null
}

function entryIndexFor(sportSettings, group) {
  const types = GROUP_TYPES[group] || []
  return (sportSettings || []).findIndex((s) => Array.isArray(s.types) && s.types.some((t) => types.includes(t)))
}

/** intervals sportSettings[] → { cycling:{ftp,maxHr,lthr}, running:{thresholdPace,maxHr,lthr}, swimming:{...} } */
export function fromIcuSportSettings(sportSettings) {
  const out = {}
  for (const group of Object.keys(GROUP_TYPES)) {
    const idx = entryIndexFor(sportSettings, group)
    if (idx < 0) continue
    const e = sportSettings[idx]
    const stat = {}
    if (group === 'cycling' && e.ftp != null) stat.ftp = e.ftp
    if (e.max_hr != null) stat.maxHr = e.max_hr
    if (e.lthr != null) stat.lthr = e.lthr
    const pace = paceFromMps(group, e.threshold_pace)
    if (pace != null) stat.thresholdPace = pace
    out[group] = stat
  }
  return out
}

/**
 * Apply a per-group patch onto a COPY of intervals sportSettings[], touching ONLY the
 * target group's entry (other sports + every custom field left exactly as-is). Returns
 * the full modified array to PUT back, or null if that sport-group isn't present.
 * patch keys: ftp (cycling only), maxHr, lthr, thresholdPace (group-native units).
 */
export function applyPatchToSportSettings(sportSettings, group, patch) {
  const arr = (sportSettings || []).map((s) => ({ ...s }))
  const idx = entryIndexFor(arr, group)
  if (idx < 0) return null
  const e = arr[idx]
  if (group === 'cycling' && 'ftp' in patch) e.ftp = patch.ftp
  if ('maxHr' in patch) e.max_hr = patch.maxHr
  if ('lthr' in patch) e.lthr = patch.lthr
  if ('thresholdPace' in patch) e.threshold_pace = mpsFromPace(group, patch.thresholdPace)
  arr[idx] = e
  return arr
}

/** Which Platyplus sport name (Profile chips) maps to which intervals group. */
export const SPORT_TO_GROUP = { cycling: 'cycling', running: 'running', swimming: 'swimming' }
