// #403 — the ATHLETE PROFILE synthesis: read FTP·TTE·CP·W′·EF (cycling) / threshold·TTE·CS·D′·EF (running)
// TOGETHER and say (a) what kind of athlete you are, (b) a coach read per metric, and (c) what the coach will
// work on — all improvable through NORMAL training, no crazy exhaustion tests. Pure + unit-tested.
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
    r: inp.eftp != null && inp.cp != null && ((cyc && inp.threshold > inp.cp + 4) || (!cyc && inp.threshold < inp.cp - 8))
      ? `Sits ${cyc ? 'above' : 'faster than'} your ${cyc ? 'CP' : 'critical speed'} — a touch optimistic; the coach nudges it toward your ${cyc ? 'eFTP' : 'modelled'} value.`
      : `In line with your ${cyc ? 'CP' : 'critical speed'} — a fair threshold.` })
  if (inp.tte != null) reads.push({ k: 'TTE', v: `${mmss(inp.tte)}`, r: shortTte ? `The big lever. Normal is 30–70 min — yours is short, so build threshold endurance (no test — long tempo does it).` : longTte ? `Long — excellent fatigue resistance. Now push the ceiling.` : `Reasonable — keep extending it with tempo.` })
  if (inp.reserveKj != null) reads.push({ k: cyc ? 'W′' : 'D′', v: cyc ? `${inp.reserveKj} kJ` : `${inp.reserveKj} m`, r: bigReserve ? `Big anaerobic battery — a real weapon for surges & sprints.` : `Moderate — enough to cover surges, not a pure sprinter.` })
  if (inp.ef != null) reads.push({ k: 'EF', v: `${inp.efTrend === 'up' ? '↑ ' : inp.efTrend === 'down' ? '↓ ' : ''}${inp.ef.toFixed(2)}`, r: inp.efTrend === 'up' ? `Rising — your aerobic engine is improving even if ${cyc ? 'FTP' : 'pace'} is flat. Stay the course.` : inp.efTrend === 'down' ? `Slipping — check sleep/stress/fuelling before adding load.` : `Steady — a stable aerobic base.` })

  // what the coach will work on — everything here is TRAINING, no exhaustion tests.
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
  focus.push('No formal test needed — these efforts ARE the data: your CP/W′/TTE models sharpen as you do them.')
  return { type, emoji, badge, summary, reads, focus }
}
