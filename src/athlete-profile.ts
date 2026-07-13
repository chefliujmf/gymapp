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
export interface SwRead { lead: string; body: string } // #508 — one explicit strength + one thing to improve
export interface AthleteProfileResult { type: string; emoji: string; badge: string; summary: string; strength: SwRead; weakness: SwRead; reads: MetricRead[]; focus: string[] }

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

  // #508 — ONE explicit strength + ONE thing to improve (JM). This is what the coach reads to know you. Derived from
  // the same type/metrics, sport-aware; references the real number where it helps (TTE, the kick reserve).
  const kick = cyc ? 'W′' : 'D′'
  const kickV = inp.reserveKj != null ? (cyc ? `${inp.reserveKj} kJ` : `${inp.reserveKj} m`) : ''
  const tteTxt = inp.tte != null ? mmss(inp.tte) : null
  let strength: SwRead, weakness: SwRead
  if (shortTte) {
    strength = { lead: cyc ? 'Power at threshold' : 'Speed at threshold', body: `You reach a strong ${cyc ? 'wattage' : 'pace'}${kickV ? `, and your kick (${kick} ${kickV}) covers surges` : ''} — you can hit hard efforts.` }
    weakness = { lead: 'Staying power', body: `You can't hold threshold long yet${tteTxt ? ` — your TTE is short (${tteTxt} vs a normal 30–70 min)` : ''}. Turning ${cyc ? 'power' : 'speed'} into duration is your single biggest lever.` }
  } else if (longTte && !bigReserve) {
    strength = { lead: 'Endurance', body: `Strong fatigue resistance — you hold ${cyc ? 'power' : 'pace'} a long time${tteTxt ? ` (TTE ${tteTxt})` : ''} and recover fast between efforts.` }
    weakness = { lead: 'Top-end ceiling', body: `Your ${cyc ? 'FTP' : 'threshold'} has room to climb — the gain now is raising the roof (VO₂ / short-max work), not more duration.` }
  } else if (longTte && bigReserve) {
    strength = { lead: 'Well-rounded', body: `Strong endurance${tteTxt ? ` (TTE ${tteTxt})` : ''} and a real kick${kickV ? ` (${kick} ${kickV})` : ''} — few weak spots.` }
    weakness = { lead: 'Sharpen the top', body: `Little to fix — polish the very top end (short VO₂ / neuromuscular efforts) to squeeze out more.` }
  } else if (bigReserve) {
    strength = { lead: 'Punch', body: `A big anaerobic reserve${kickV ? ` (${kick} ${kickV})` : ''} — attacks, surges and the ${cyc ? 'sprint' : 'kick'} are your weapon.` }
    weakness = { lead: 'Threshold duration', body: `You fade on sustained efforts${tteTxt ? ` — your TTE (${tteTxt}) is the lever` : ''}. Extensive tempo turns punch into staying power.` }
  } else {
    strength = { lead: 'Balanced base', body: `Solid across the board — no glaring weakness, a good platform to build from.` }
    weakness = { lead: 'Lift it all a notch', body: `Grow your threshold duration (tempo) and your top end (VO₂) together for steady, broad progress.` }
  }

  const reads: MetricRead[] = []
  if (inp.threshold != null) reads.push({ k: cyc ? 'FTP' : 'Threshold', v: cyc ? `${Math.round(inp.threshold)} W` : `${mmss(inp.threshold)}/km`, // #464 whole watts (was 240.27774)
    r: `Your ~1-hour ceiling — the anchor every training zone is built from. ${inp.eftp != null && ((cyc && inp.threshold > inp.eftp + 4) || (!cyc && inp.threshold < inp.eftp - 8))
      ? `You've set it ${cyc ? 'a little above' : 'a little faster than'} the computed value (${cyc ? `${Math.round(inp.eftp)} W` : `${mmss(inp.eftp)}/km`}), so it reads a touch optimistic — the coach plans from the computed number so your zones land right.`
      : `It lines up with the computed value — a fair, honest read.`} It re-reads itself off every hard effort you do.` })
  if (inp.tte != null) reads.push({ k: 'TTE', v: `${mmss(inp.tte)}`, r: `How long you can HOLD threshold before output drops — the truest read of your endurance, normally 30–70 min. ${shortTte ? `Yours is short: you can HIT the power but not live there yet — the single biggest lever you have. Extensive threshold work (long tempo, 3×15–20 @ 90–95%) stretches it; more watts won't.` : longTte ? `Yours is long — excellent fatigue resistance. The gain now is a higher ceiling (VO₂/FTP work), not more duration.` : `Reasonable — keep nudging it out with sustained tempo.`}` })
  if (inp.reserveKj != null) reads.push({ k: cyc ? 'W′' : 'D′', v: cyc ? `${inp.reserveKj} kJ` : `${inp.reserveKj} m`, r: `Your anaerobic "battery" above ${cyc ? 'CP' : 'critical speed'} — what powers attacks, surges and the final ${cyc ? 'sprint' : 'kick'}. ${bigReserve ? `Yours is big — a real weapon; a weekly short-max set keeps it sharp.` : `Yours is moderate — enough to cover surges, not a pure sprinter. Short near-max reps grow it (steady endurance alone won't).`}` })
  if (inp.ef != null) reads.push({ k: 'EF', v: `${inp.efTrend === 'up' ? '↑ ' : inp.efTrend === 'down' ? '↓ ' : ''}${inp.ef.toFixed(2)}`, r: `${cyc ? 'Power' : 'Pace'} per heartbeat — how efficient your aerobic engine is, and the number that usually moves BEFORE ${cyc ? 'FTP' : 'pace'} does. ${inp.efTrend === 'up' ? `Rising — you're getting fitter even while ${cyc ? 'FTP' : 'pace'} looks flat. That's real progress; stay the course.` : inp.efTrend === 'down' ? `Slipping — usually fatigue, not lost fitness. Check sleep, stress and fuelling before adding load.` : `Steady — a stable aerobic base to build on.`}` })

  // what the coach will work on — everything here is TRAINING; a formal test only if the model goes stale.
  const focus: string[] = []
  if (shortTte) {
    focus.push(cyc ? 'Extensive threshold — 3×15–20 min @ 90–95% FTP → turn power into staying power (grows TTE).' : 'Extensive threshold runs — 3×15–20 min @ threshold → build the duration you can hold pace.')
    if (inp.eftp != null && inp.threshold != null && ((cyc && inp.threshold > inp.eftp) || (!cyc && inp.threshold < inp.eftp))) focus.push(cyc ? `Ease FTP toward your eFTP (${Math.round(inp.eftp)} W) until your TTE reaches ~40 min.` : `Ease your threshold pace toward the modelled value until your TTE reaches ~40 min.`)
  } else if (longTte) {
    focus.push(cyc ? 'Raise the ceiling — short VO₂ intervals (4–5×3–4 min @ ~108–112% FTP), 1–2 a week, to lift FTP/CP: hard but brief.' : 'Raise the ceiling — short VO₂ intervals (5–6×3 min @ ~3 k–5 k pace), 1–2 a week, to lift threshold/CS: hard but brief.')
  } else {
    focus.push(cyc ? 'Alternate a threshold-endurance week (3×15–20 min @ 88–94% FTP) with a VO₂ week (5×3–4 min @ ~110%).' : 'Alternate threshold-endurance (3×15–20 min @ threshold) with short 5 k-pace reps (5–6×3 min).')
  }
  if (!bigReserve) focus.push(cyc ? 'Keep the punch — a weekly short-sprint set (30 s–3 min) holds/grows W′.' : 'Keep the kick — weekly short fast reps (200–600 m) hold/grow D′.')
  focus.push(cyc ? 'Aerobic volume underneath — feeds a rising EF and a higher future FTP.' : 'Easy aerobic volume underneath — feeds a rising EF and future pace.')
  focus.push('Mostly the efforts ARE the data — your CP/W′/TTE models sharpen as you do them; a short benchmark test only if the fit goes stale.')
  return { type, emoji, badge, summary, strength, weakness, reads, focus }
}
