// #404 — server-side performance metrics so the COACH can reason with the athlete's ACTUAL values (CP/W′/CS/D′/
// TTE/EF + profile), not just the theory. Pure. ⚠️ MIRRORS src/tte.ts + src/athlete-profile.ts — keep in sync
// (the client renders these; this feeds the coach). Unit-tested via src/perf-metrics.test.ts.

export const MIN_TTE_SEC = 120

// --- TTE (mirror src/tte.ts) ------------------------------------------------
export function tteFromPower(secs, watts, eftp) {
  if (!secs?.length || !watts?.length || !(Number(eftp) > 0)) return null
  let best = 0
  for (let i = 0; i < secs.length; i++) if (watts[i] != null && watts[i] >= eftp && secs[i] > best) best = secs[i]
  return best >= MIN_TTE_SEC ? best : null
}
export function tteModelPower(eftp, cp, wPrimeJ) {
  if (!(Number(eftp) > 0) || !(Number(cp) > 0) || !(Number(wPrimeJ) > 0) || eftp <= cp) return null
  const t = Math.round(wPrimeJ / (eftp - cp))
  return t >= MIN_TTE_SEC ? Math.min(7200, t) : null
}
export function tteFromPace(dist, timeSec, thresholdSecKm) {
  if (!dist?.length || !timeSec?.length || !(Number(thresholdSecKm) > 0)) return null
  let best = 0
  for (let i = 0; i < dist.length; i++) {
    if (!(dist[i] > 0) || !(timeSec[i] > 0)) continue
    if ((timeSec[i] / dist[i]) * 1000 <= thresholdSecKm && timeSec[i] > best) best = timeSec[i]
  }
  return best >= MIN_TTE_SEC ? best : null
}
export function tteModelPace(thresholdSecKm, cs, dPrime) {
  if (!(Number(thresholdSecKm) > 0) || !(Number(cs) > 0) || !(Number(dPrime) > 0)) return null
  const v = 1000 / thresholdSecKm, gap = v - cs
  if (gap <= 0) return null
  const t = Math.round(dPrime / gap)
  return t >= MIN_TTE_SEC ? Math.min(7200, t) : null
}

// --- Efficiency Factor trend (mirror src/intervals.ts fetchEfTrend) ---------
// points: [{date, ef}] sorted ascending → { latest, trend, deltaPct }
export function efSummary(points) {
  const p = (points || []).filter((x) => x && Number(x.ef) > 0)
  if (p.length < 2) return { latest: p.length ? p[p.length - 1].ef : null, trend: null, deltaPct: null }
  const h = Math.floor(p.length / 2)
  const older = p.slice(0, h).reduce((s, x) => s + x.ef, 0) / h
  const recent = p.slice(h).reduce((s, x) => s + x.ef, 0) / (p.length - h)
  const deltaPct = older > 0 ? Math.round(((recent - older) / older) * 1000) / 10 : null
  return { latest: p[p.length - 1].ef, trend: recent > older * 1.02 ? 'up' : recent < older * 0.98 ? 'down' : 'flat', deltaPct }
}

// --- Athlete profile (mirror src/athlete-profile.ts) ------------------------
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
export function athleteProfile(inp) {
  const cyc = inp.sport === 'cycling'
  const tteMin = inp.tte != null ? inp.tte / 60 : null
  const shortTte = tteMin != null && tteMin < 25, longTte = tteMin != null && tteMin >= 40
  const bigReserve = inp.reserveKj != null && inp.reserveBig != null && inp.reserveKj >= inp.reserveBig
  let type = 'Balanced', badge = 'building', summary = ''
  if (shortTte) { type = 'Punchy threshold'; badge = 'building endurance'; summary = `Good ${cyc ? 'power' : 'speed'}, short staying power — can HIT threshold but not HOLD it yet.` }
  else if (longTte) { type = bigReserve ? 'All-rounder' : 'Diesel engine'; badge = bigReserve ? 'well-rounded' : 'raise the ceiling'; summary = bigReserve ? 'Strong fatigue resistance AND a healthy kick.' : `Strong fatigue resistance, modest kick — ${cyc ? 'FTP' : 'threshold'} has room to climb.` }
  else { type = bigReserve ? 'Puncheur' : 'Balanced'; badge = bigReserve ? 'punchy' : 'building'; summary = bigReserve ? 'Punchy — big anaerobic reserve on a solid base.' : 'Balanced base — room to grow threshold duration + top end.' }
  const focus = []
  if (shortTte) {
    focus.push(cyc ? 'Extensive threshold 3×15–20 min @ 90–95% FTP → grow TTE.' : 'Extensive threshold runs 3×15–20 min → build hold-time.')
    if (inp.eftp != null && inp.threshold != null && ((cyc && inp.threshold > inp.eftp) || (!cyc && inp.threshold < inp.eftp))) focus.push(cyc ? `Ease FTP toward eFTP (${inp.eftp} W) until TTE ~40 min.` : 'Ease threshold pace toward the modelled value until TTE ~40 min.')
  } else if (longTte) focus.push(cyc ? 'Raise the ceiling: 4×8–12 min @ 100–105% FTP.' : 'Raise the ceiling: 4×8–12 min @ ~5 k effort.')
  else focus.push(cyc ? 'Alternate a threshold-endurance week (3×20 @ 90–95%) with an FTP week (4×10 @ 100–105%).' : 'Alternate threshold-endurance with 5 k-pace intervals.')
  if (!bigReserve) focus.push(cyc ? 'Weekly short-sprint set (30 s–3 min) for W′.' : 'Weekly short fast reps (200–600 m) for D′.')
  focus.push(cyc ? 'Aerobic volume underneath → rising EF + higher future FTP.' : 'Easy aerobic volume → rising EF + future pace.')
  focus.push('Mostly the efforts ARE the data — the CP/W′/TTE models sharpen as they train; a short benchmark test only if the fit goes stale.')
  return { type, badge, summary, tteMin, focus }
}
