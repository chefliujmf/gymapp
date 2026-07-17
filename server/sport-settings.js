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
    if (group === 'cycling' && e.w_prime != null) stat.wPrime = Math.round(e.w_prime / 100) / 10 // #578 W′: intervals stores JOULES → our kJ (1 decimal)
    if (e.max_hr != null) stat.maxHr = e.max_hr
    if (e.lthr != null) stat.lthr = e.lthr
    const pace = paceFromMps(group, e.threshold_pace)
    if (pace != null) stat.thresholdPace = pace
    out[group] = stat
  }
  return out
}

/**
 * Build the per-entry intervals write for a group's patch. The ONLY way to change a sport
 * setting is `PUT /athlete/{id}/sport-settings/{entryId}` with just the changed fields — a
 * `PUT /athlete/{id}` with {sportSettings} returns 200 but is silently ignored (verified on
 * the real account), and a full-athlete PUT is 403. Sending only the changed field means
 * intervals leaves every other field — including custom_field_values (#147) — exactly as-is.
 * Returns { id, body } (body in intervals field names) or null if the group isn't present.
 * patch keys: ftp (cycling only), maxHr, lthr, thresholdPace (group-native units).
 */
export function icuPatchForGroup(sportSettings, group, patch) {
  const idx = entryIndexFor(sportSettings, group)
  if (idx < 0) return null
  const e = sportSettings[idx]
  if (e.id == null) return null
  const body = {}
  if (group === 'cycling' && 'ftp' in patch) body.ftp = patch.ftp
  if (group === 'cycling' && 'wPrime' in patch && patch.wPrime != null) body.w_prime = Math.round(patch.wPrime * 1000) // #578 W′: our kJ → intervals JOULES
  if ('maxHr' in patch) body.max_hr = patch.maxHr
  if ('lthr' in patch) body.lthr = patch.lthr
  if ('thresholdPace' in patch) body.threshold_pace = mpsFromPace(group, patch.thresholdPace)
  return { id: e.id, body }
}

/** Which Platyplus sport name (Profile chips) maps to which intervals group. */
export const SPORT_TO_GROUP = { cycling: 'cycling', running: 'running', swimming: 'swimming' }

/**
 * #268/#1003/#459 — map Platyplus profile-BASICS edits to an intervals athlete PUT body (WRITE-BACK, verified: a partial
 * `PUT /athlete/{id}` merges + returns 200). `changed` = the keys the user just set (req.body); values come from the
 * merged profile. Units: height cm → METRES; sex male/female → M/F; dob (YYYY-MM-DD) passthrough. Only maps a field the
 * user actually changed AND that's valid — so a blank/invalid value never clobbers what intervals already has.
 */
export function athleteBasicsPatch(changed, { heightCm, dob, sex } = {}) {
  const has = (k) => Array.isArray(changed) && changed.includes(k)
  const w = {}
  if (has('heightCm') && heightCm > 0) w.height = Math.round(heightCm) / 100
  if (has('dob') && /^\d{4}-\d{2}-\d{2}/.test(dob || '')) w.icu_date_of_birth = String(dob).slice(0, 10)
  if (has('sex') && (sex === 'male' || sex === 'female')) w.sex = sex === 'female' ? 'F' : 'M'
  return w
}

// #512 — Daniels VDOT from RACE times: the reliable running anchor. MIRRORS src/running-paces.ts — KEEP IN SYNC.
const _vo2 = (v) => -4.6 + 0.182258 * v + 0.000104 * v * v
const _pctMax = (t) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)
const _velForVo2 = (o2) => { const a = 0.000104, b = 0.182258, c = -(o2 + 4.6); return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a) }
const vdotFromRace = (distM, timeSec) => (distM > 0 && timeSec > 0 ? _vo2(distM / (timeSec / 60)) / _pctMax(timeSec / 60) : NaN)
const thresholdFromVdot = (vdot) => Math.round(60000 / _velForVo2(vdot * 0.88))
const csFromVdot = (vdot) => Math.round(60000 / _velForVo2(vdot * 0.90)) // CS just above threshold → threshold ≤ CS holds
function bestVdotFromRaces(races) {
  const vs = races.map((r) => vdotFromRace(r.distM, r.timeSec)).filter((v) => Number.isFinite(v) && v >= 20 && v <= 82).sort((a, b) => a - b)
  if (!vs.length) return null
  const med = vs[Math.floor(vs.length / 2)], clean = vs.filter((v) => v <= med * 1.12)
  return Math.round(Math.max(...(clean.length ? clean : vs)) * 10) / 10
}
// intervals pace-curve = distance[] + values[] (best TIME per distance). Pull the best time at each standard race
// distance (nearest bucket within 10%) — a best over ≥1.5 km can't be faked by one GPS spike, so it's a clean anchor.
function raceBestsFromPaceCurve(paceCurve) {
  const list = (paceCurve && paceCurve.list) || []
  const c = list.find((x) => Array.isArray(x.distance) && Array.isArray(x.values)) || list[0] || {}
  const D = c.distance || [], V = c.values || [], out = []
  for (const target of [1500, 3000, 5000, 10000, 21097]) {
    let bi = -1, bd = Infinity
    for (let i = 0; i < D.length; i++) if (D[i] > 0 && V[i] > 0) { const dd = Math.abs(D[i] - target); if (dd < bd) { bd = dd; bi = i } }
    if (bi >= 0 && bd <= target * 0.1) out.push({ distM: D[bi], timeSec: V[bi] })
  }
  return out
}
/** #512 — running TTE at THRESHOLD from Daniels' pctMax curve (mirror of src/running-paces.ts tteAtThresholdSec).
 *  Threshold is by definition your ~1-hour pace → the aerobic ceiling is ~67 min, VDOT-independent. Used as the TTE
 *  fallback when threshold ≤ CS (the VDOT read), where the CS/D′ "above-critical" model gives no finite time. Seconds. */
export function tteAtThresholdSec() {
  let lo = 1, hi = 240
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (_pctMax(m) > 0.88) lo = m; else hi = m }
  return Math.round(((lo + hi) / 2) * 60)
}
/** #512 — the runner's threshold from their RACE VDOT (reliable) if there are sane race bests, else null. */
export function runVdotFromPaceCurve(paceCurve) {
  const bests = raceBestsFromPaceCurve(paceCurve)
  const vdot = bestVdotFromRaces(bests)
  return vdot ? { vdot, thresholdPace: thresholdFromVdot(vdot), csPace: csFromVdot(vdot), nRaces: bests.length } : null
}

/**
 * #215/#512 — the runner's threshold pace. PREFER race VDOT (Daniels, from actual race times — the running gold
 * standard) over intervals' Critical-Speed model, which UNDER-READS off mostly-easy runs (it can even fit CS slower
 * than the athlete's real threshold → a bogus short TTE, JM's bug). Falls back to the CS asymptote when there's no
 * sane race. Returns { thresholdPace, csPace, vdot?, criticalSpeed?, source, r2 }.
 */
export function runThresholdFromPaceCurve(paceCurve, minR2 = 0.7) {
  const v = runVdotFromPaceCurve(paceCurve)
  const list = (paceCurve && paceCurve.list) || []
  let raw = null
  for (const c of list) { const cs = ((c && c.paceModels) || []).find((m) => m.type === 'CS' && m.criticalSpeed > 0); if (cs && (cs.r2 == null || cs.r2 >= minR2)) { raw = cs; break } }
  if (v) return { thresholdPace: v.thresholdPace, csPace: v.csPace, vdot: v.vdot, criticalSpeed: raw ? raw.criticalSpeed : null, source: 'race VDOT', r2: 0.9 }
  // #506d — no race: fall back to the CS asymptote, slowed 2.5% (CS overestimates MLSS by ~2-3%, Jones & Vanhatalo 2017).
  if (raw) return { thresholdPace: Math.round(1000 / raw.criticalSpeed * 1.025), csPace: Math.round(1000 / raw.criticalSpeed), criticalSpeed: raw.criticalSpeed, source: 'critical speed', r2: raw.r2 != null ? raw.r2 : null }
  return null
}
