// #403 — the ATHLETE PROFILE synthesis: read FTP·TTE·CP·W′·EF (cycling) / threshold·TTE·CS·D′·EF (running)
// TOGETHER and say (a) what kind of athlete you are, (b) a coach read per metric, and (c) what the coach will
// work on — improvable mostly through NORMAL training (a short benchmark test only if the model goes stale). Pure + unit-tested.
// Framework: "high FTP + short TTE = fragile/punchy · moderate FTP + long TTE = diesel" (beyond-FTP sources).

export type Trend = 'up' | 'down' | 'flat' | null
export interface ProfileInputs {
  sport: 'cycling' | 'running'
  threshold?: number | null   // FTP (W) or threshold pace (sec/km)
  eftp?: number | null        // eFTP (W) or modelled threshold pace — the more trusted estimate
  tte?: number | null         // seconds
  cp?: number | null          // W (cycling) or critical speed pace sec/km (running)
  reserveKj?: number | null   // W′ kJ (cycling) or D′ m (running) — anaerobic reserve
  reserveBig?: number | null  // threshold to call the reserve "big" (kJ or m)
  ef?: number | null          // latest efficiency factor
  efTrend?: Trend             // EF direction over recent weeks
}
export interface MetricRead { k: string; v: string; r: string }
export interface AthleteProfileResult { type: string; emoji: string; badge: string; summary: string; reads: MetricRead[]; focus: string[] }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export function athleteProfile(inp: ProfileInputs): AthleteProfileResult {
  const cyc = inp.sport === 'cycling'
  const tteMin = inp.tte != null ? inp.tte / 60 : null
  // classify by fatigue resistance (TTE) — the axis that most changes the training focus.
  let type = 'Balanced', emoji = cyc ? '🚴' : '🏃', badge = 'building', summary = ''
  const shortTte = tteMin != null && tteMin < 25
  const longTte = tteMin != null && tteMin >= 40
  const bigReserve = inp.reserveKj != null && inp.reserveBig != null && inp.reserveKj >= inp.reserveBig
  if (shortTte) { type = 'Punchy threshold'; badge = 'building endurance'; summary = `Good ${cyc ? 'power' : 'speed'}, short staying power — you can HIT threshold but not HOLD it yet. The opportunity is turning that into endurance.` }
  else if (longTte) { type = bigReserve ? 'All-rounder' : 'Diesel engine'; badge = bigReserve ? 'well-rounded' : 'raise the ceiling'; summary = bigReserve ? `Strong fatigue resistance AND a healthy kick — a genuine all-rounder. Sharpen the top end.` : `Strong fatigue resistance, modest kick — a classic diesel. Your ${cyc ? 'FTP' : 'threshold'} has room to climb.` }
  else { type = bigReserve ? 'Puncheur' : 'Balanced'; badge = bigReserve ? 'punchy' : 'building'; summary = bigReserve ? `A punchy profile — a big anaerobic reserve on a solid base. Keep that spark while stretching your threshold duration.` : `A balanced base — solid across the board with room to grow your threshold duration and top end.` }

  const reads: MetricRead[] = []
  if (inp.threshold != null) reads.push({ k: cyc ? 'FTP' : 'Threshold', v: cyc ? `${inp.threshold} W` : `${mmss(inp.threshold)}/km`,
    r: `Your ~1-hour ceiling — the anchor every training zone is built from. ${inp.eftp != null && inp.cp != null && ((cyc && inp.threshold > inp.cp + 4) || (!cyc && inp.threshold < inp.cp - 8))
      ? `It sits ${cyc ? 'above' : 'faster than'} your ${cyc ? 'CP' : 'critical speed'}, so it's a touch optimistic — the coach eases it toward your ${cyc ? 'eFTP' : 'modelled'} value so your zones land right.`
      : `It lines up with your ${cyc ? 'CP' : 'critical speed'} — a fair, honest threshold.`} It re-reads itself off every hard effort you do.` })
  if (inp.tte != null) reads.push({ k: 'TTE', v: `${mmss(inp.tte)}`, r: `How long you can HOLD threshold before output drops — the truest read of your endurance, normally 30–70 min. ${shortTte ? `Yours is short: you can HIT the power but not live there yet — the single biggest lever you have. Extensive threshold work (long tempo, 3×15–20 @ 90–95%) stretches it; more watts won't.` : longTte ? `Yours is long — excellent fatigue resistance. The gain now is a higher ceiling (VO₂/FTP work), not more duration.` : `Reasonable — keep nudging it out with sustained tempo.`}` })
  if (inp.reserveKj != null) reads.push({ k: cyc ? 'W′' : 'D′', v: cyc ? `${inp.reserveKj} kJ` : `${inp.reserveKj} m`, r: `Your anaerobic "battery" above ${cyc ? 'CP' : 'critical speed'} — what powers attacks, surges and the final ${cyc ? 'sprint' : 'kick'}. ${bigReserve ? `Yours is big — a real weapon; a weekly short-max set keeps it sharp.` : `Yours is moderate — enough to cover surges, not a pure sprinter. Short near-max reps grow it (steady endurance alone won't).`}` })
  if (inp.ef != null) reads.push({ k: 'EF', v: `${inp.efTrend === 'up' ? '↑ ' : inp.efTrend === 'down' ? '↓ ' : ''}${inp.ef.toFixed(2)}`, r: `${cyc ? 'Power' : 'Pace'} per heartbeat — how efficient your aerobic engine is, and the number that usually moves BEFORE ${cyc ? 'FTP' : 'pace'} does. ${inp.efTrend === 'up' ? `Rising — you're getting fitter even while ${cyc ? 'FTP' : 'pace'} looks flat. That's real progress; stay the course.` : inp.efTrend === 'down' ? `Slipping — usually fatigue, not lost fitness. Check sleep, stress and fuelling before adding load.` : `Steady — a stable aerobic base to build on.`}` })

  // what the coach will work on — everything here is TRAINING; a formal test only if the model goes stale.
  const focus: string[] = []
  if (shortTte) {
    focus.push(cyc ? 'Extensive threshold — 3×15–20 min @ 90–95% FTP → turn power into staying power (grows TTE).' : 'Extensive threshold runs — 3×15–20 min @ threshold → build the duration you can hold pace.')
    if (inp.eftp != null && inp.threshold != null && ((cyc && inp.threshold > inp.eftp) || (!cyc && inp.threshold < inp.eftp))) focus.push(cyc ? `Ease FTP toward your eFTP (${inp.eftp} W) until your TTE reaches ~40 min.` : `Ease your threshold pace toward the modelled value until your TTE reaches ~40 min.`)
  } else if (longTte) {
    focus.push(cyc ? 'Raise the ceiling — 4×8–12 min @ 100–105% FTP to lift FTP/CP.' : 'Raise the ceiling — 4×8–12 min @ ~5 k effort to lift threshold/CS.')
  } else {
    focus.push(cyc ? 'Alternate a threshold-endurance week (3×20 min @ 90–95%) with an FTP week (4×10 min @ 100–105%).' : 'Alternate threshold-endurance (3×15–20 min) with 5 k-pace intervals.')
  }
  if (!bigReserve) focus.push(cyc ? 'Keep the punch — a weekly short-sprint set (30 s–3 min) holds/grows W′.' : 'Keep the kick — weekly short fast reps (200–600 m) hold/grow D′.')
  focus.push(cyc ? 'Aerobic volume underneath — feeds a rising EF and a higher future FTP.' : 'Easy aerobic volume underneath — feeds a rising EF and future pace.')
  focus.push('Mostly the efforts ARE the data — your CP/W′/TTE models sharpen as you do them; a short benchmark test only if the fit goes stale.')
  return { type, emoji, badge, summary, reads, focus }
}
