import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { localISO } from '../date'
import { fetchWellness, fetchPowerCurve, type IcuWellness, type PowerCurve } from '../intervals'
import { useAuth } from '../auth/AuthContext'
import { PowerCurveChart, InfoDot, bestAt } from '../charts'
import { hasModule } from '../modules'
import { DateRangeFilter, TRAINING_PRESETS } from '../DateRange'
import { MiniCard, last } from './Fitness'
import { BenchmarksCard } from '../Benchmarks'

// #225 — Cycling per-sport stats: power curve · eFTP · VO₂max · W/kg. Split out of /fitness (which
// is now global Load & Form only).
export default function CyclingStats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [from, setFrom] = useState(localISO(new Date(Date.now() - 90 * 86400000)))
  const [to, setTo] = useState(localISO())
  const [rows, setRows] = useState<IcuWellness[] | null>(null)
  const [pc, setPc] = useState<PowerCurve | null>(null)
  const isCycling = hasModule(user?.sports || [], 'cycling')

  useEffect(() => {
    if (!from || !to) return
    const [f, t] = from <= to ? [from, to] : [to, from]
    setRows(null); setPc(null)
    fetchWellness(f, t).then(setRows).catch(() => setRows([]))
    fetchPowerCurve(Math.max(1, Math.round((Date.parse(t) - Date.parse(f)) / 86400000))).then(setPc).catch(() => setPc(null))
  }, [from, to])

  const s = useMemo(() => {
    const r = rows || []
    const col = (k: keyof IcuWellness) => r.map((d) => d[k] as number | null)
    return { eftp: col('eftp'), weight: col('weight') }
  }, [rows])

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Cycling</h1><p>Power curve · eFTP · VO₂max · W/kg, from intervals.icu</p></div>
      </div>
      {!isCycling ? (
        <p className="meta">Add Cycling in <span style={{ color: 'var(--accent)' }}>Profile</span> to see your power stats.</p>
      ) : !user?.hasIcuKey ? (
        <p className="meta">Connect intervals.icu in <span style={{ color: 'var(--accent)' }}>Profile</span> to see your power curve & FTP.</p>
      ) : (
        <>
          {/* #385 — same polished benchmark cards as Global, filtered to cycling (FTP · VO₂max · Max HR). */}
          <BenchmarksCard only={['ftp', 'vo2max', 'maxHr']} />
          <DateRangeFilter presets={TRAINING_PRESETS} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          {rows === null ? <p className="meta">Loading…</p> : (
            <>
              {/* eFTP TREND over the range (the benchmark card shows the current value + confidence; this is the history). */}
              <div className="fit-grid">
                <MiniCard title="eFTP trend" value={last(s.eftp)} unit=" W" hint="Estimated threshold power — watts you can hold ~1 hour. Higher = stronger. The line is your trend over this range." series={{ label: '', color: '#ffb020', data: s.eftp }} />
              </div>
              {pc ? (
                <div className="card" style={{ padding: '12px 14px', marginTop: 12 }}>
                  <div className="fit-legend"><span style={{ color: '#34e07d' }}>● Power curve<InfoDot text="The most power (watts) you can hold for each duration — sprints on the left (seconds), endurance on the right (hours). Push a line up = you got stronger at that effort." /></span></div>
                  <PowerCurveChart secs={pc.secs} watts={pc.watts} />
                  <div className="be-row">
                    {([[5, '5s'], [60, '1m'], [300, '5m'], [1200, '20m']] as [number, string][]).map(([d, label]) => {
                      const w = bestAt(pc.secs, pc.watts, d), wt = last(s.weight)
                      return <div key={label} className="be"><span>{label}</span><b>{w ? Math.round(w) : '—'} W</b>{w && wt ? <em>{(w / wt).toFixed(2)} W/kg</em> : null}</div>
                    })}
                  </div>
                </div>
              ) : <p className="meta" style={{ marginTop: 10 }}>No power-curve data in this range.</p>}
              <p className="meta" style={{ marginTop: 10 }}>Read live from intervals.icu.</p>
            </>
          )}
        </>
      )}
    </div>
  )
}
