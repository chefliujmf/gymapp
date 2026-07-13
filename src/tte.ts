// #401 — TTE (Time To Exhaustion at threshold), a LEARNED benchmark per sport. TTE isn't stored by
// intervals; it's read off your mean-max curve as the LONGEST duration you can hold your threshold:
//  · cycling — the longest time your best power is still ≥ your eFTP,
//  · running — the longest time your best pace is still ≤ (as fast as) your threshold pace.
// Curve-based (not the CP/W′ formula) so it matches what you've actually DONE and intervals' own TTE.
// Pure + unit-tested (src/tte.test.ts).

// A "TTE" shorter than this means you can't actually hold the reference for a meaningful time → the FTP/
// threshold is set too high, not a real time-to-exhaustion. Fall back to the learning state (null) instead
// of showing an alarming 0:22. 2 min is a floor well below any genuine threshold hold (which is 20–70 min).
export const MIN_TTE_SEC = 120

/** Longest duration (seconds) your power curve stays ≥ eFTP. secs ascending, watts descending. */
export function tteFromPower(secs: number[], watts: number[], eftp: number | null | undefined): number | null {
  if (!secs?.length || !watts?.length || !(Number(eftp) > 0)) return null
  let best = 0
  for (let i = 0; i < secs.length; i++) if (watts[i] != null && watts[i] >= (eftp as number) && secs[i] > best) best = secs[i]
  return best >= MIN_TTE_SEC ? best : null
}

/** Longest duration (seconds) your pace curve stays ≤ threshold pace (i.e. AT LEAST that fast). The pace
 *  curve is distance-indexed: dist[i] metres covered in timeSec[i] s → pace = timeSec/dist·1000 (s/km). */
export function tteFromPace(dist: number[], timeSec: number[], thresholdSecKm: number | null | undefined): number | null {
  if (!dist?.length || !timeSec?.length || !(Number(thresholdSecKm) > 0)) return null
  let best = 0
  for (let i = 0; i < dist.length; i++) {
    if (!(dist[i] > 0) || !(timeSec[i] > 0)) continue
    const paceSecKm = (timeSec[i] / dist[i]) * 1000
    if (paceSecKm <= (thresholdSecKm as number) && timeSec[i] > best) best = timeSec[i]
  }
  return best >= MIN_TTE_SEC ? best : null
}

/** Model-based TTE ESTIMATE (fallback when the curve hasn't shown a real threshold hold). From the
 *  Critical-Power / Critical-Speed 2-param model: time to exhaust W′/D′ at the power/pace above CP/CS.
 *  Cycling: W′ / (eFTP − CP). Estimated → lower confidence than an observed (curve) TTE. */
export function tteModelPower(eftp: number | null | undefined, cp: number | null | undefined, wPrime: number | null | undefined): number | null {
  if (!(Number(eftp) > 0) || !(Number(cp) > 0) || !(Number(wPrime) > 0)) return null
  const gap = (eftp as number) - (cp as number)
  if (gap <= 0) return null // eFTP at/below CP → effectively unbounded, not a TTE
  const t = Math.round((wPrime as number) / gap)
  return t >= MIN_TTE_SEC ? Math.min(7200, t) : null
}
/** Running model TTE: D′ / (v_threshold − CS), v in m/s from the threshold pace (sec/km). */
export function tteModelPace(thresholdSecKm: number | null | undefined, cs: number | null | undefined, dPrime: number | null | undefined): number | null {
  if (!(Number(thresholdSecKm) > 0) || !(Number(cs) > 0) || !(Number(dPrime) > 0)) return null
  const v = 1000 / (thresholdSecKm as number)
  const gap = v - (cs as number)
  if (gap <= 0) return null // threshold at/below CS → unbounded
  const t = Math.round((dPrime as number) / gap)
  return t >= MIN_TTE_SEC ? Math.min(7200, t) : null
}

/** Which TTE to SHOW. The model estimate IS the inference — we never beg for a test (JM #508). A curve/observed
 *  TTE is only a FLOOR (you rarely ride your FTP to true exhaustion, so "longest you happened to hold it" under-
 *  states you), so it wins ONLY when it's LONGER than the model — a genuine longer hold that beats the prediction.
 *  Otherwise the modeled W′/CP (or D′/CS) value is shown, flagged estimated. */
export function pickTte(observed: number | null | undefined, modeled: number | null | undefined): { sec: number | null; estimated: boolean } {
  const obs = observed ?? null, mod = modeled ?? null
  if (mod != null && (obs == null || mod >= obs)) return { sec: mod, estimated: true }
  return { sec: obs, estimated: false }
}

/** m:ss (or h:mm:ss) for a TTE in seconds. */
export function fmtTte(sec: number): string {
  const s = Math.round(sec)
  if (s >= 3600) return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
