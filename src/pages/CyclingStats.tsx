import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { localISO } from '../date'
import { fetchWellness, fetchEfTrend, fetchPowerCurve, type IcuWellness, type EfTrend, type PowerCurve } from '../intervals'
import { useAuth } from '../auth/AuthContext'
import { TrendChart, InfoDot, DurationCurve } from '../charts'
import { hasModule } from '../modules'
import { DateRangeFilter, TRAINING_PRESETS } from '../DateRange'
import { last } from './Fitness'

// #420 — one plain-language takeaway for the eFTP trend (matches the EF-chart insight style).
function eftpInsight(a: (number | null)[]): string {
  const vals = a.filter((v): v is number => v != null)
  if (vals.length < 2) return 'Your eFTP will trend here as intervals reads it from your hard efforts.'
  const first = vals[0], lastV = vals[vals.length - 1], d = Math.round(lastV - first)
  return d > 3 ? `📈 eFTP is up ${d} W over this range — your threshold is climbing.`
    : d < -3 ? `📉 eFTP has eased ${-d} W — normal in a base/recovery block; it rebounds with sharper efforts.`
      : `➡️ eFTP is holding steady around ${Math.round(lastV)} W.`
}
import { BenchmarksCard } from '../Benchmarks'
import SeasonCompare from '../SeasonCompare'

// #508 — the engine's centrepiece on the Cycling page: your power-duration curve, fitted, with the CP asymptote + W′.
// Every benchmark below (FTP · CP · W′ · TTE · VO₂max) is derived from THIS curve — one coherent read.
function PowerCurveCard() {
  const [curve, setCurve] = useState<PowerCurve | null>(null)
  useEffect(() => { fetchPowerCurve(365).then(setCurve).catch(() => {}) }, [])
  if (!curve || !(curve.secs && curve.secs.length >= 3)) return null
  const cp = curve.cp ?? null
  const wPrime = curve.wPrime != null ? Math.round(curve.wPrime / 100) / 10 : null // kJ, 0.1 precision
  const at = (t: number) => { for (let i = 0; i < curve.secs.length; i++) if (curve.secs[i] >= t) return curve.watts[i]; return null }
  const map5 = at(300)
  const insight = cp != null
    ? `One fit, your whole engine: Critical Power ${Math.round(cp)} W is the sustainable floor${wPrime != null ? `, W′ ${wPrime} kJ the battery above it` : ''}. FTP, TTE and your zones all read off this curve — change one, the rest follow.`
    : 'Your power-duration curve. CP, W′, FTP and TTE will all read off it once intervals has efforts across durations.'
  return (
    <div className="card" style={{ padding: 14, marginBottom: 12 }}>
      <div className="section-title" style={{ fontSize: 13, marginBottom: 4 }}>Your power curve, fitted <InfoDot text="The best power you can hold for each duration (log-time axis). The dashed line is Critical Power — the floor you can sustain indefinitely; the shaded area above it is W′, your anaerobic battery. FTP, TTE and your zones are all derived from this one curve." /></div>
      <DurationCurve secs={curve.secs} values={curve.watts} asymptote={cp} unit=" W" reserveLabel={wPrime != null ? `W′ ${wPrime} kJ` : undefined} anchors={[{ sec: 300, label: map5 != null ? `${map5} · MAP` : '5m' }, { sec: 1200, label: '20m' }]} />
      <p className="meta" style={{ marginTop: 6, color: 'var(--text-dim)' }}>{insight}</p>
    </div>
  )
}

// #225 — Cycling per-sport stats: power curve · eFTP · VO₂max · W/kg. Split out of /fitness (which
// is now global Load & Form only).
export default function CyclingStats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [from, setFrom] = useState(localISO(new Date(Date.now() - 90 * 86400000)))
  const [to, setTo] = useState(localISO())
  const [rows, setRows] = useState<IcuWellness[] | null>(null)
  const [ef, setEf] = useState<EfTrend | null>(null) // #403 efficiency-factor trend
  const isCycling = hasModule(user?.sports || [], 'cycling')
  useEffect(() => { if (user?.hasIcuKey && isCycling) fetchEfTrend('Ride', 90).then(setEf).catch(() => {}) }, [user?.hasIcuKey, isCycling])

  useEffect(() => {
    if (!from || !to) return
    const [f, t] = from <= to ? [from, to] : [to, from]
    setRows(null)
    fetchWellness(f, t).then(setRows).catch(() => setRows([]))
  }, [from, to])

  const s = useMemo(() => {
    const r = rows || []
    const col = (k: keyof IcuWellness) => r.map((d) => d[k] as number | null)
    // #420 — eFTP is only stamped on the days intervals recomputes it (most days are null → the trend rendered as an
    // empty box). It HOLDS its value between updates, so forward-fill: each gap carries the last known eFTP → a
    // continuous step line. Leading nulls (before the first estimate) stay null.
    const ffill = (a: (number | null)[]) => { let last: number | null = null; return a.map((v) => (v != null ? (last = v) : last)) }
    return { eftp: ffill(col('eftp')), weight: col('weight') }
  }, [rows])

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Cycling</h1><p>Power curve · eFTP · VO₂max, from intervals.icu</p></div>
      </div>
      {!isCycling ? (
        <p className="meta">Add Cycling in <span style={{ color: 'var(--accent)' }}>Profile</span> to see your power stats.</p>
      ) : !user?.hasIcuKey ? (
        <p className="meta">Connect intervals.icu in <span style={{ color: 'var(--accent)' }}>Profile</span> to see your power curve & FTP.</p>
      ) : (
        <>
          {/* #508 — the power-duration curve first (the engine), then the metrics that all read off it. */}
          <PowerCurveCard />
          {/* #385 — same polished benchmark cards as Global, filtered to cycling (FTP · VO₂max · Max HR). */}
          <BenchmarksCard only={['ftp', 'cp', 'wPrime', 'vo2max', 'tteRide', 'maxHr']} profile="cycling" />
          <DateRangeFilter presets={TRAINING_PRESETS} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          {rows === null ? <p className="meta">Loading…</p> : (
            <>
              {/* #420 — eFTP trend as a FULL-WIDTH standard chart (axes + labels + insight), matching EF below. */}
              {s.eftp.some((v) => v != null) && (
                <div className="card" style={{ padding: '12px 14px', marginTop: 12 }}>
                  <div className="fit-legend"><span style={{ color: '#ffb020' }}>● eFTP trend<InfoDot text="Estimated threshold power — the watts you can hold ~1 hour. intervals re-reads it from every hard effort; it holds its value between updates. The line is your trend over this range." /></span></div>
                  <TrendChart series={[{ label: 'eFTP', color: '#ffb020', data: s.eftp, area: true }]} height={120} axes unit=" W" labels={(rows || []).map((d) => new Date(d.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))} />
                  <p className="fit-insight">{eftpInsight(s.eftp)}</p>
                </div>
              )}
              {/* #403 — Efficiency Factor: aerobic engine (power ÷ HR), rising = fitter even when FTP is flat. */}
              {ef && ef.points.length >= 2 && (
                <div className="card" style={{ padding: '12px 14px', marginTop: 12 }}>
                  <div className="fit-legend"><span style={{ color: '#34e07d' }}>● Efficiency Factor<InfoDot text="Power ÷ heart rate on your rides — your aerobic engine. Rising = more power per heartbeat (fitter), even when FTP is flat. Watch the TREND over ~6 rides, not one." /></span></div>
                  <TrendChart series={[{ label: 'EF', color: '#34e07d', data: ef.points.map((p) => p.ef), area: true }]} height={120} axes labels={ef.points.map((p) => new Date(p.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))} />
                  <p className="fit-insight">{ef.trend === 'up' ? `📈 EF is climbing (${ef.deltaPct != null && ef.deltaPct > 0 ? '+' : ''}${ef.deltaPct}%) — your aerobic engine is improving, even if FTP is flat. Keep the base work.` : ef.trend === 'down' ? `📉 EF is slipping (${ef.deltaPct}%) — check sleep, stress or fuelling before adding load.` : '➡️ EF is steady — a stable aerobic base.'}</p>
                </div>
              )}
              {/* #407/#420 — the 2-season overlay IS the power curve now (removed the old single-range curve to avoid two). */}
              <SeasonCompare sport="cycling" weight={last(s.weight)} ftp={user?.sportSettings?.cycling?.ftp ?? user?.ftp ?? null} />
              <p className="meta" style={{ marginTop: 10 }}>Read live from intervals.icu.</p>
            </>
          )}
        </>
      )}
    </div>
  )
}
