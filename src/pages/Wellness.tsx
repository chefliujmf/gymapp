import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { localISO } from '../date'
import { fetchWellness, type IcuWellness } from '../intervals'
import { authApi, type Checkin } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { DateRangeFilter, RECOVERY_PRESETS } from '../DateRange'
import { wellnessInsights } from '../wellness-insights'

// #194a — Wellness stats page: sleep / HRV / resting-HR / weight trends from intervals + the
// check-in trend. Charts have axes, a 7-day moving average, and a min–max band (mock B). Shared
// From/To date filter with recovery-horizon presets (#226 tweak).

const round1 = (n: number) => Math.round(n * 10) / 10

/** avg/min/max over a sparse series (nulls skipped) — drives the breakdown legend stats. */
export function seriesStats(data: (number | null)[]): { avg: number; min: number; max: number } | null {
  const vals = data.filter((v): v is number => v != null)
  if (!vals.length) return null
  return { avg: round1(vals.reduce((a, b) => a + b, 0) / vals.length), min: Math.min(...vals), max: Math.max(...vals) }
}

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
 *  shaded min–max band with dashed bounds. Geometry in a 0–100 stretchable SVG; ALL text is an
 *  HTML overlay (so labels stay crisp — no font-stretch — and are placed to avoid collisions). #194 mock B. */
function WTrend({ data, dates, color, unit = '' }: { data: (number | null)[]; dates: string[]; color: string; unit?: string }) {
  const pts = data.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
  if (pts.length < 2) return <p className="meta" style={{ margin: '8px 2px' }}>Not enough data in this range.</p>
  const vals = pts.map((p) => p.v)
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1, mid = round1((mn + mx) / 2)
  const n = data.length
  const px = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 0)
  const py = (v: number) => (1 - (v - mn) / rng) * 100 // 0 = top, 100 = bottom
  const mavPts = movingAvg(data).map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
  const line = (arr: { v: number; i: number }[]) => arr.map((p) => `${px(p.i).toFixed(2)},${py(p.v).toFixed(2)}`).join(' ')
  const xTicks = [0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1]
  return (
    <div className="wt">
      <div className="wt__plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="wt__svg" aria-hidden="true">
          <rect x={0} y={0} width={100} height={100} fill={color} fillOpacity={0.07} />
          <line x1={0} y1={py(mid)} x2={100} y2={py(mid)} stroke="#222732" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={0} x2={100} y2={0} stroke={color} strokeDasharray="3 3" strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={100} x2={100} y2={100} stroke={color} strokeDasharray="3 3" strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
          <polyline points={line(pts)} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.32} vectorEffect="non-scaling-stroke" />
          <polyline points={line(mavPts)} fill="none" stroke={color} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* y-axis labels (HTML, crisp) */}
        <span className="wt__y" style={{ top: '0%' }}>{round1(mx)}</span>
        <span className="wt__y" style={{ top: '50%' }}>{mid}</span>
        <span className="wt__y" style={{ top: '100%' }}>{round1(mn)}</span>
        {/* min/max value labels, kept off the x-axis row */}
        <span className="wt__mm wt__mm--max" style={{ color }}>max {mx}{unit}</span>
        <span className="wt__mm wt__mm--min" style={{ color }}>min {mn}{unit}</span>
      </div>
      <div className="wt__x">{xTicks.map((i) => <span key={i}>{dates[i] || ''}</span>)}</div>
    </div>
  )
}

function MetricCard({ title, data, dates, color, unit = '' }: { title: string; data: (number | null)[]; dates: string[]; color: string; unit?: string }) {
  const vals = data.filter((v): v is number => v != null)
  const now = vals.length ? vals[vals.length - 1] : null
  const avg = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  return (
    <div className="card wcard">
      <div className="wcard__h"><h3>{title}</h3><span className="wcard__now">{now ?? '—'}<small>{unit}</small></span></div>
      {vals.length ? <div className="wcard__sub">avg {avg}{unit} · min {Math.min(...vals)} · max {Math.max(...vals)}</div> : null}
      <WTrend data={data} dates={dates} color={color} unit={unit} />
      <div className="wcard__leg"><span><i style={{ borderColor: color, opacity: 0.4 }} />daily</span><span><i style={{ borderColor: color }} />7-day average</span></div>
    </div>
  )
}

// #383 — Check-in breakdown: Sleep · Energy · Form as three lines in ONE graph (7-day avg each),
// the overall average as a faint dashed line, and a tappable legend that spotlights one metric
// (others fade). All series share one y-scale (all are 1–5). Mirrors WTrend's stretchable-SVG +
// crisp-HTML-overlay approach. Renders whenever there are check-ins in range (no intervals needed).
type Focus = 'sleep' | 'energy' | 'form' | null
const CB_METRICS = [
  { key: 'sleep' as const, name: 'Sleep', emoji: '😴', color: '#5ec8ff' },
  { key: 'energy' as const, name: 'Energy', emoji: '⚡', color: '#34e07d' },
  { key: 'form' as const, name: 'Form', emoji: '🔋', color: '#f5b53d' },
]
const CB_OVERALL_COLOR = '#9b8cff'

function CheckinBreakdown({ series, dates }: { series: Record<'sleep' | 'energy' | 'form', (number | null)[]>; dates: string[] }) {
  const [focus, setFocus] = useState<Focus>(null)
  // 7-day-avg lines (drawn); overall = mean of the three present values per day, then 7-day-avg.
  const avgLines = useMemo(() => ({
    sleep: movingAvg(series.sleep), energy: movingAvg(series.energy), form: movingAvg(series.form),
  }), [series])
  const overallDaily = useMemo(() => series.sleep.map((_, i) => {
    const parts = [series.sleep[i], series.energy[i], series.form[i]].filter((v): v is number => v != null)
    return parts.length ? round1(parts.reduce((a, b) => a + b, 0) / parts.length) : null
  }), [series])
  const overallAvgLine = useMemo(() => movingAvg(overallDaily), [overallDaily])
  // legend stats come from the RAW daily values (not the smoothed line).
  const stats = { sleep: seriesStats(series.sleep), energy: seriesStats(series.energy), form: seriesStats(series.form) }
  const overallStat = seriesStats(overallDaily)

  // one y-scale across all three 7-day-avg lines + the overall line, with a little headroom.
  const drawn = [avgLines.sleep, avgLines.energy, avgLines.form, overallAvgLine]
  const all = drawn.flat().filter((v): v is number => v != null)
  if (all.length < 2 || !overallStat) return <p className="meta" style={{ margin: '8px 2px' }}>Not enough check-ins in this range.</p>
  const rawMn = Math.min(...all), rawMx = Math.max(...all)
  const pad = (rawMx - rawMn || 1) * 0.12
  const mn = Math.max(1, round1(rawMn - pad)), mx = Math.min(5, round1(rawMx + pad)), rng = mx - mn || 1, mid = round1((mn + mx) / 2)
  const n = dates.length
  const px = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 0)
  const py = (v: number) => (1 - (v - mn) / rng) * 100
  const toLine = (arr: (number | null)[]) => arr.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
    .map((p) => `${px(p.i).toFixed(2)},${py(p.v).toFixed(2)}`).join(' ')
  const xTicks = [0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1]

  const latest = (arr: (number | null)[]) => { const v = arr.filter((x): x is number => x != null); return v.length ? v[v.length - 1] : null }
  const focused = focus ? CB_METRICS.find((m) => m.key === focus)! : null
  const headTitle = focused ? focused.name : 'Check-in breakdown'
  const headNow = focused ? latest(avgLines[focus!]) : overallStat.avg
  const headColor = focused ? focused.color : 'var(--text)'

  return (
    <div className="card wcard">
      <div className="wcard__h">
        <h3>📝 {headTitle} (1–5)</h3>
        <span className="wcard__now" style={{ color: headColor }}>{headNow ?? '—'}</span>
      </div>
      <div className="wcard__sub">Overall avg {overallStat.avg} · min {overallStat.min} · max {overallStat.max}{!focus ? ' — tap a metric to focus' : ''}</div>
      <div className="wt cb">
        <div className="wt__plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="wt__svg" aria-hidden="true">
            <line x1={0} y1={0} x2={100} y2={0} stroke="#222732" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={py(mid)} x2={100} y2={py(mid)} stroke="#222732" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={100} x2={100} y2={100} stroke="#222732" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <polyline points={toLine(overallAvgLine)} fill="none" stroke={CB_OVERALL_COLOR} strokeWidth={1.4} strokeDasharray="4 3" strokeOpacity={focus ? 0.15 : 0.5} vectorEffect="non-scaling-stroke" />
            {CB_METRICS.map((m) => {
              const on = !focus || focus === m.key
              return <polyline key={m.key} points={toLine(avgLines[m.key])} fill="none" stroke={m.color} strokeWidth={focus === m.key ? 3 : 2.2} strokeOpacity={on ? 1 : 0.18} vectorEffect="non-scaling-stroke" />
            })}
          </svg>
          <span className="wt__y" style={{ top: '0%' }}>{mx}</span>
          <span className="wt__y" style={{ top: '50%' }}>{mid}</span>
          <span className="wt__y" style={{ top: '100%' }}>{mn}</span>
        </div>
        <div className="wt__x">{xTicks.map((i) => <span key={i}>{dates[i] || ''}</span>)}</div>
      </div>
      <div className="cb__leg">
        {CB_METRICS.map((m) => {
          const s = stats[m.key]; const on = !focus || focus === m.key
          return (
            <button key={m.key} type="button" className={`cb__row${on ? '' : ' dim'}`} aria-pressed={focus === m.key}
              onClick={() => setFocus((f) => (f === m.key ? null : m.key))}>
              <i style={{ background: m.color }} />
              <span className="cb__nm">{m.emoji} {m.name}</span>
              <span className="cb__st">{s ? <>avg <b>{s.avg}</b> · min {s.min} · max {s.max}</> : 'no data'}</span>
            </button>
          )
        })}
        <div className="cb__mini"><span><i style={{ background: CB_OVERALL_COLOR }} />overall avg (faint)</span></div>
      </div>
    </div>
  )
}

export default function Wellness() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [from, setFrom] = useState(localISO(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo] = useState(localISO())
  const [rows, setRows] = useState<IcuWellness[] | null>(null)
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const connected = !!user?.hasIcuKey

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
    // check-in components per day (1–5): Sleep, Energy, Form(=6−soreness readiness Freshness).
    const ci = (get: (c: Checkin) => number | null | undefined) =>
      days.map((d) => { const c = ciByDay.get(d); const v = c ? get(c) : null; return v ?? null })
    const checkinSeries = {
      sleep: ci((c) => c.sleep),
      energy: ci((c) => c.energy),
      form: ci((c) => (c.soreness != null ? 6 - c.soreness : null)),
    }
    // overall readiness = mean of the three present components for the day
    const checkin = days.map((_, i) => {
      const parts = [checkinSeries.sleep[i], checkinSeries.energy[i], checkinSeries.form[i]].filter((x): x is number => x != null)
      return parts.length ? round1(parts.reduce((a, b) => a + b, 0) / parts.length) : null
    })
    const hasCheckins = checkin.some((v) => v != null)
    const labels = days.map((d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    return { dates: labels, sleep: col('sleepHours'), hrv: col('hrv'), rhr: col('restingHR'), weight: col('weight'), checkin, checkinSeries, hasCheckins }
  }, [rows, checkins, from, to])

  const anyWellness = (rows || []).some((r) => r.sleepHours != null || r.hrv != null || r.restingHR != null || r.weight != null)
  // #249: coach-voice insights from the trends (explained for an adult + tips)
  const insights = useMemo(() => wellnessInsights({ sleep: view.sleep, hrv: view.hrv, rhr: view.rhr, weight: view.weight, sleepNeed: user?.sleepNeed ?? undefined }), [view, user?.sleepNeed])

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Wellness</h1><p>Sleep · HRV · resting HR · weight — from intervals & your check-ins</p></div>
      </div>

      <DateRangeFilter presets={RECOVERY_PRESETS} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />

      {!connected && <p className="meta" style={{ margin: '0 2px 10px' }}>Connect intervals.icu in <span style={{ color: 'var(--accent)' }}>Profile</span> for sleep / HRV / resting-HR / weight trends. Your check-in trend shows below regardless.</p>}
      {rows === null ? <p className="meta">Loading…</p> : (
        <>
          {insights.length > 0 && (
            <div className="card wcoach">
              <div className="wcoach__h">💬 Coach insights</div>
              {insights.map((i) => (
                <div key={i.metric} className="wcoach__row">
                  <div className="wcoach__t"><b>{i.emoji} {i.metric}.</b> {i.text}</div>
                  {i.tip && <div className="wcoach__tip">💡 {i.tip}</div>}
                </div>
              ))}
            </div>
          )}
          {connected && anyWellness && (
            <>
              <MetricCard title="😴 Sleep" data={view.sleep} dates={view.dates} color="#5ec8ff" unit="h" />
              <MetricCard title="💓 HRV" data={view.hrv} dates={view.dates} color="#34e07d" />
              <MetricCard title="❤️ Resting HR" data={view.rhr} dates={view.dates} color="#ff8fb1" />
              <MetricCard title="⚖️ Weight" data={view.weight} dates={view.dates} color="#f0b145" unit="kg" />
            </>
          )}
          {connected && !anyWellness && <p className="meta">No sleep/HRV/weight in this range — they sync in from your device via intervals.</p>}
          {view.hasCheckins
            ? <CheckinBreakdown series={view.checkinSeries} dates={view.dates} />
            : <p className="meta">No check-ins in this range yet — log your daily Sleep · Energy · Form to see the breakdown.</p>}
        </>
      )}
    </div>
  )
}
