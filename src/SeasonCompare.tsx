import { useEffect, useState } from 'react'
import { fetchPowerSeasons, fetchPaceSeasons, type PowerSeason, type PaceSeason } from './intervals'
import { PowerCurveChart, PaceCurveChart } from './charts'
import { POWER_DURATIONS, PACE_DISTANCES, seasonDelta } from './season-compare'
import { fmtPace } from './running-paces'
import { tteFromPower, tteModelPower, tteFromPace, tteModelPace, fmtTte } from './tte'

// #407 — SEASON COMPARISON: overlay 2 seasons on the power/pace curve + a compare table (This season | a season
// you pick | Δ) with the derived metrics. Seasons are trailing windows (This=YTD · Last=365d · 2-ago=730d · All);
// exact-year + custom-range is the #415 server-computed follow-up. Data + pure helpers are unit-tested; this is
// the thin view. Renders nothing until intervals data loads (null → hidden, so a keyless athlete sees no gap).
const fmtTime = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`)

function Delta({ v, unit }: { v: number | null; unit: string }) {
  if (v == null) return <span className="sc-d sc-d--eq">—</span>
  const cls = v > 0 ? 'sc-d--up' : v < 0 ? 'sc-d--dn' : 'sc-d--eq'
  return <span className={`sc-d ${cls}`}>{v === 0 ? '0' : `${v > 0 ? '+' : ''}${v}${unit}`}</span>
}

export default function SeasonCompare({ sport, weight, threshold }: { sport: 'cycling' | 'running'; weight?: number | null; threshold?: number | null }) {
  const [power, setPower] = useState<PowerSeason[] | null | undefined>(undefined)
  const [pace, setPace] = useState<PaceSeason[] | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    if (sport === 'cycling') fetchPowerSeasons().then((s) => live && setPower(s)).catch(() => live && setPower(null))
    else fetchPaceSeasons().then((s) => live && setPace(s)).catch(() => live && setPace(null))
    return () => { live = false }
  }, [sport])
  const seasons: (PowerSeason | PaceSeason)[] | null | undefined = sport === 'cycling' ? power : pace
  if (seasons === undefined) return <div className="card"><div className="sc-load">Loading season comparison…</div></div>
  if (!seasons || seasons.length < 2) return null // no key / not enough data → hide (benchmarks above still show)
  return <SeasonCompareView sport={sport} seasons={seasons} weight={weight} threshold={threshold} />
}

// Presentational (given loaded season data) — separated so it can be render-verified with real data.
export function SeasonCompareView({ sport, seasons, weight, threshold }: { sport: 'cycling' | 'running'; seasons: (PowerSeason | PaceSeason)[]; weight?: number | null; threshold?: number | null }) {
  const [pick, setPick] = useState('all') // compared season key
  const thisS = seasons[0]
  const cmp = seasons.find((s) => s.key === pick) || seasons[seasons.length - 1]
  const wkg = (w: number | null) => (w != null && weight ? ` ${(w / weight).toFixed(2)}` : '')

  // curve overlay + insight
  const overlay = sport === 'cycling'
    ? { secs: (cmp as PowerSeason).secs, watts: (cmp as PowerSeason).watts, color: 'var(--blue, #5aa9ff)' }
    : { secs: (cmp as PaceSeason).secs, pace: (cmp as PaceSeason).pace, color: 'var(--blue, #5aa9ff)' }

  const rows = sport === 'cycling'
    ? POWER_DURATIONS.map((d, i) => {
      const a = (thisS as PowerSeason).best[i], b = (cmp as PowerSeason).best[i]
      return { label: d.label, a: a != null ? `${a}` : null, aSub: wkg(a), b: b != null ? `${b}` : null, bSub: wkg(b), d: seasonDelta(a, b, true), unit: 'W' }
    })
    : PACE_DISTANCES.map((d, i) => {
      const a = (thisS as PaceSeason).best[i], b = (cmp as PaceSeason).best[i]
      const paceOf = (t: number | null) => (t != null && d.m ? ` ${fmtPace(Math.round((t / d.m) * 1000))}/km` : '')
      return { label: d.label, a: a != null ? fmtTime(a) : null, aSub: paceOf(a), b: b != null ? fmtTime(b) : null, bSub: paceOf(b), d: seasonDelta(a, b, false), unit: 's' }
    })

  const vo2 = (s: PowerSeason) => (weight && s.best[2] != null ? Math.round((10.8 * (s.best[2]! / weight) + 7) * 10) / 10 : null) // #420 — VO₂max from the season's best 5-min MAP
  // #420 — TTE per season: observed (longest ≥ threshold on that season's curve) else modelled (CP/W′ · CS/D′).
  const tteCyc = (s: PowerSeason) => tteFromPower(s.secs, s.watts, s.ftp ?? null) ?? tteModelPower(s.ftp ?? null, s.cp ?? null, s.wPrime ?? null)
  const tteRun = (s: PaceSeason) => (threshold != null ? (tteFromPace(s.dist, s.secs, threshold) ?? tteModelPace(threshold, s.cs ?? null, s.dPrime ?? null)) : null)
  const metrics = sport === 'cycling'
    ? [
      { k: 'eFTP', a: (thisS as PowerSeason).ftp, b: (cmp as PowerSeason).ftp, unit: 'W', hi: true },
      { k: 'VO₂max', a: vo2(thisS as PowerSeason), b: vo2(cmp as PowerSeason), unit: '', hi: true },
      { k: 'CP', a: (thisS as PowerSeason).cp, b: (cmp as PowerSeason).cp, unit: 'W', hi: true },
      { k: "W′", a: kj((thisS as PowerSeason).wPrime), b: kj((cmp as PowerSeason).wPrime), unit: 'kJ', hi: true },
      { k: 'TTE', a: tteCyc(thisS as PowerSeason), b: tteCyc(cmp as PowerSeason), unit: '', hi: true, tte: true },
    ]
    : [
      { k: 'Crit Speed', a: csPace((thisS as PaceSeason).cs), b: csPace((cmp as PaceSeason).cs), unit: '/km', hi: false, pace: true },
      { k: "D′", a: mtr((thisS as PaceSeason).dPrime), b: mtr((cmp as PaceSeason).dPrime), unit: 'm', hi: true },
      { k: 'TTE', a: tteRun(thisS as PaceSeason), b: tteRun(cmp as PaceSeason), unit: '', hi: true, tte: true },
    ]

  return (
    <>
      <div className="card sc-card">
        <div className="sc-title">{sport === 'cycling' ? 'Power' : 'Pace'} curve · 2-season overlay</div>
        <div className="sc-legend">
          <span><i className="sc-dot" style={{ background: 'var(--accent)' }} />This season</span>
          <span><i className="sc-dot" style={{ background: 'var(--blue, #5aa9ff)' }} />{cmp.label}</span>
        </div>
        {sport === 'cycling'
          ? <PowerCurveChart secs={(thisS as PowerSeason).secs} watts={(thisS as PowerSeason).watts} overlay={overlay as { secs: number[]; watts: number[]; color?: string }} height={190} />
          : <PaceCurveChart secs={(thisS as PaceSeason).secs} pace={(thisS as PaceSeason).pace} overlay={overlay as { secs: number[]; pace: number[]; color?: string }} height={190} />}
        <div className="sc-pick">
          <span className="meta">Compare to:</span>
          {seasons.slice(1).map((s) => (
            <button key={s.key} className={'sc-pill' + (pick === s.key ? ' on' : '')} onClick={() => setPick(s.key)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="card sc-card">
        <div className="sc-title">Best efforts · this season vs {cmp.label.toLowerCase()}</div>
        <div className="sc-tablewrap">
          <table className="sc-table">
            <thead><tr><th>{sport === 'cycling' ? 'Time' : 'Dist'}</th><th>This season</th><th className="sc-blue">{cmp.label}</th><th>Δ</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="sc-lbl">{r.label}</td>
                  <td>{r.a == null ? <span className="sc-dim">—</span> : <span className="sc-v">{r.a}<i className="sc-sub">{r.aSub}</i></span>}</td>
                  <td>{r.b == null ? <span className="sc-dim">—</span> : <span className="sc-v">{r.b}<i className="sc-sub">{r.bSub}</i></span>}</td>
                  <td><Delta v={r.d} unit={r.unit} /></td>
                </tr>
              ))}
              <tr className="sc-msep"><td colSpan={4}>Metrics</td></tr>
              {metrics.map((m) => {
                const av = m.a ?? null, bv = m.b ?? null
                const dv = (av != null && bv != null) ? (m.hi ? Math.round((av - bv) * 10) / 10 : Math.round((bv - av) * 10) / 10) : null
                const isTte = !!(m as { tte?: boolean }).tte, isPace = !!(m as { pace?: boolean }).pace
                const fmt = (v: number | null) => v == null ? <span className="sc-dim">—</span> : <span className="sc-v">{isTte ? fmtTte(v) : isPace ? `${fmtPace(v)}/km` : `${v} ${m.unit}`}</span>
                return (
                  <tr key={m.k} className="sc-mrow">
                    <td className="sc-lbl">{m.k}</td><td>{fmt(av)}</td><td>{fmt(bv)}</td>
                    <td><Delta v={dv} unit={isPace || isTte ? 's' : m.unit} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="sc-insight">{seasonInsight(sport, thisS, cmp)}</p>
      </div>
    </>
  )
}

const kj = (j?: number) => (j != null ? Math.round(j / 100) / 10 : null)
const mtr = (m?: number) => (m != null ? Math.round(m) : null)
const csPace = (cs?: number) => (cs != null && cs > 0 ? Math.round(1000 / cs) : null)

// one plain-language takeaway: where this season stands vs the compared one, by the 20-min / 5 k anchor.
function seasonInsight(sport: 'cycling' | 'running', a: PowerSeason | PaceSeason, b: PowerSeason | PaceSeason): string {
  if (sport === 'cycling') {
    const ai = (a as PowerSeason).best[3], bi = (b as PowerSeason).best[3] // 20 min
    if (ai == null || bi == null) return `Overlay of this season vs ${b.label.toLowerCase()} — best at each duration; Δ shows the gap.`
    const d = ai - bi
    return d >= 0 ? `Your 20-min power is at/above your ${b.label.toLowerCase()} (${ai} vs ${bi} W) — holding your best. Green Δ = at/above, red = below.`
      : `Your 20-min power is ${-d} W below your ${b.label.toLowerCase()} (${ai} vs ${bi} W) — a clear build target. Green Δ = at/above, red = below.`
  }
  const ai = (a as PaceSeason).best[2], bi = (b as PaceSeason).best[2] // 5 k
  if (ai == null || bi == null) return `Overlay of this season vs ${b.label.toLowerCase()} — fastest at each distance; Δ shows the gap.`
  const d = bi - ai // positive = this faster
  return d >= 0 ? `Your 5 k is at/ahead of your ${b.label.toLowerCase()} — sharp. Green Δ = faster, red = slower.`
    : `Your 5 k is ${Math.round(-d)} s slower than your ${b.label.toLowerCase()} — a target to race back. Green Δ = faster, red = slower.`
}
