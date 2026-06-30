import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { localISO } from '../date'
import { fetchWellness, type IcuWellness } from '../intervals'
import { authApi, type Checkin } from '../auth/api'
import { useAuth } from '../auth/AuthContext'

// #194a — Wellness stats page: sleep / HRV / resting-HR / weight trends from intervals + the
// check-in trend, with a 7d/30d/60d/custom range filter. Charts have axes, a 7-day moving
// average, and a min–max band (mock option B approved 2026-06-30).

const RANGES: [string, number][] = [['7 d', 7], ['30 d', 30], ['60 d', 60]]
const round1 = (n: number) => Math.round(n * 10) / 10

/** All ISO dates from..to inclusive (so charts have a stable axis even with gaps). */
function dayRange(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(from + 'T00:00:00Z'), end = new Date(to + 'T00:00:00Z')
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10))
  return out
}
/** 7-day trailing moving average over a sparse series (nulls skipped within the window). */
function movingAvg(data: (number | null)[], w = 7): (number | null)[] {
  return data.map((_, i) => {
    const win = data.slice(Math.max(0, i - w + 1), i + 1).filter((v): v is number => v != null)
    return win.length ? round1(win.reduce((a, b) => a + b, 0) / win.length) : null
  })
}

/** Rich trend chart — Y axis (min/mid/max), dated X axis, faint daily line, bold 7-day average,
 *  and a shaded min–max band with dashed bounds. (#194 mock B.) */
function WTrend({ data, dates, color, unit = '', invert = false }: { data: (number | null)[]; dates: string[]; color: string; unit?: string; invert?: boolean }) {
  const pts = data.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
  if (pts.length < 2) return <p className="meta" style={{ margin: '8px 2px' }}>Not enough data in this range.</p>
  const W = 320, H = 168, L = 32, R = 10, T = 10, B = 20
  const iw = W - L - R, ih = H - T - B
  const vals = pts.map((p) => p.v)
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1
  const n = data.length
  const x = (i: number) => L + (n > 1 ? (i / (n - 1)) * iw : 0)
  const y = (v: number) => T + ih - ((v - mn) / rng) * ih
  const mav = movingAvg(data)
  const mavPts = mav.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
  const line = (arr: { v: number; i: number }[]) => arr.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const mid = round1((mn + mx) / 2)
  // "good" end of the band for the label (RHR: lower is better → invert)
  const hi = invert ? mn : mx, lo = invert ? mx : mn
  const xTicks = [0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1]
  return (
    <svg className="wtrend" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      {/* min–max band */}
      <rect x={L} y={y(mx).toFixed(1)} width={iw} height={(y(mn) - y(mx)).toFixed(1)} fill={color} fillOpacity={0.08} />
      {[mn, mid, mx].map((v) => (
        <g key={v}><line x1={L} y1={y(v).toFixed(1)} x2={W - R} y2={y(v).toFixed(1)} stroke="#222732" /><text x={L - 4} y={(y(v) + 3).toFixed(1)} textAnchor="end" className="wt-ax">{round1(v)}</text></g>
      ))}
      <line x1={L} y1={y(mx).toFixed(1)} x2={W - R} y2={y(mx).toFixed(1)} stroke={color} strokeDasharray="3 3" strokeOpacity={0.6} />
      <line x1={L} y1={y(mn).toFixed(1)} x2={W - R} y2={y(mn).toFixed(1)} stroke={color} strokeDasharray="3 3" strokeOpacity={0.6} />
      {xTicks.map((i) => <text key={i} x={x(i).toFixed(1)} y={H - 5} textAnchor="middle" className="wt-ax">{dates[i] || ''}</text>)}
      <polyline points={line(pts)} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />
      <polyline points={line(mavPts)} fill="none" stroke={color} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
      <text x={W - R} y={(y(hi) - 3).toFixed(1)} textAnchor="end" className="wt-mm" fill={color}>max {mx}{unit}</text>
      <text x={W - R} y={(y(lo) + 10).toFixed(1)} textAnchor="end" className="wt-mm" fill={color}>min {mn}{unit}</text>
    </svg>
  )
}

function MetricCard({ title, data, dates, color, unit = '', invert = false }: { title: string; data: (number | null)[]; dates: string[]; color: string; unit?: string; invert?: boolean }) {
  const vals = data.filter((v): v is number => v != null)
  const now = vals.length ? vals[vals.length - 1] : null
  const avg = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  return (
    <div className="card wcard">
      <div className="wcard__h"><h3>{title}</h3><span className="wcard__now">{now ?? '—'}<small>{unit}</small></span></div>
      {vals.length ? <div className="wcard__sub">avg {avg}{unit} · min {Math.min(...vals)} · max {Math.max(...vals)}</div> : null}
      <WTrend data={data} dates={dates} color={color} unit={unit} invert={invert} />
      <div className="wcard__leg"><span><i style={{ borderColor: color, opacity: 0.4 }} />daily</span><span><i style={{ borderColor: color }} />7-day average</span></div>
    </div>
  )
}

export default function Wellness() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [preset, setPreset] = useState<number | 'custom'>(30)
  const [from, setFrom] = useState(localISO(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo] = useState(localISO())
  const [rows, setRows] = useState<IcuWellness[] | null>(null)
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const connected = !!user?.hasIcuKey
  const applyPreset = (d: number) => { setPreset(d); setFrom(localISO(new Date(Date.now() - d * 86400000))); setTo(localISO()) }

  useEffect(() => {
    if (!from || !to) return
    const [f, t] = from <= to ? [from, to] : [to, from]
    setRows(null)
    if (connected) fetchWellness(f, t).then(setRows).catch(() => setRows([]))
    else setRows([])
    authApi.checkins(f, t).then(setCheckins).catch(() => setCheckins([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, connected])

  const view = useMemo(() => {
    const [f, t] = from <= to ? [from, to] : [to, from]
    const days = dayRange(f, t)
    const byDay = new Map((rows || []).map((r) => [r.date, r]))
    const ciByDay = new Map(checkins.map((c) => [c.date, c]))
    const col = (k: keyof IcuWellness) => days.map((d) => { const r = byDay.get(d); const v = r ? (r[k] as number | null) : null; return v })
    // check-in readiness = mean of energy, sleep, freshness(=6−soreness) for the day
    const checkin = days.map((d) => {
      const c = ciByDay.get(d); if (!c) return null
      const parts = [c.energy, c.sleep, c.soreness != null ? 6 - c.soreness : undefined].filter((x): x is number => x != null)
      return parts.length ? round1(parts.reduce((a, b) => a + b, 0) / parts.length) : null
    })
    const labels = days.map((d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    return { dates: labels, sleep: col('sleepHours'), hrv: col('hrv'), rhr: col('restingHR'), weight: col('weight'), checkin }
  }, [rows, checkins, from, to])

  const anyWellness = (rows || []).some((r) => r.sleepHours != null || r.hrv != null || r.restingHR != null || r.weight != null)

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Wellness</h1><p>Sleep · HRV · resting HR · weight — from intervals & your check-ins</p></div>
      </div>

      <div className="chips" style={{ marginBottom: preset === 'custom' ? 8 : 12 }}>
        {RANGES.map(([label, d]) => <button key={d} className={'chip' + (preset === d ? ' chip--active' : '')} onClick={() => applyPreset(d)}>{label}</button>)}
        <button className={'chip' + (preset === 'custom' ? ' chip--active' : '')} onClick={() => setPreset('custom')}>Custom</button>
      </div>
      {preset === 'custom' && (
        <div className="date-range">
          <label>From<input type="date" value={from} max={localISO()} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To<input type="date" value={to} max={localISO()} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      )}

      {!connected && <p className="meta" style={{ margin: '0 2px 10px' }}>Connect intervals.icu in <span style={{ color: 'var(--accent)' }}>Profile</span> for sleep / HRV / resting-HR / weight trends. Your check-in trend shows below regardless.</p>}
      {rows === null ? <p className="meta">Loading…</p> : (
        <>
          {connected && anyWellness && (
            <>
              <MetricCard title="😴 Sleep" data={view.sleep} dates={view.dates} color="#5ec8ff" unit="h" />
              <MetricCard title="💓 HRV" data={view.hrv} dates={view.dates} color="#34e07d" />
              <MetricCard title="❤️ Resting HR" data={view.rhr} dates={view.dates} color="#ff8fb1" invert />
              <MetricCard title="⚖️ Weight" data={view.weight} dates={view.dates} color="#f0b145" unit="kg" />
            </>
          )}
          {connected && !anyWellness && <p className="meta">No sleep/HRV/weight in this range — they sync in from your device via intervals.</p>}
          <MetricCard title="📝 Check-in (your 1–5)" data={view.checkin} dates={view.dates} color="#9b8cff" />
        </>
      )}
    </div>
  )
}
