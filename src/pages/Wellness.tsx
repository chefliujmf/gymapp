import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { localISO } from '../date'
import { fetchWellness, type IcuWellness } from '../intervals'
import { authApi, type Checkin } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { DateRangeFilter, RECOVERY_PRESETS } from '../DateRange'
import { wellnessInsights, type Insight } from '../wellness-insights'
import { TrendChart } from '../charts'

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

// (#395) WTrend removed — the bespoke axis-less polyline is replaced by the shared TrendChart in MetricCard
// (hover + tooltip + the one-chart standard). `movingAvg`/`seriesStats` above are still used.

// #395 — Wellness metric card now uses the SHARED TrendChart (hover scrubber + tooltip showing the date +
// value, axes) — same standard as Load & Form — with the daily as a faint underlay, the 7-day average bold,
// and the coach-voice insight for THIS metric under the chart (consistent with the Fitness charts).
function MetricCard({ title, data, dates, color, unit = '', insight }: { title: string; data: (number | null)[]; dates: string[]; color: string; unit?: string; insight?: Insight | null }) {
  const vals = data.filter((v): v is number => v != null)
  const now = vals.length ? vals[vals.length - 1] : null
  const avg = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  const mav = useMemo(() => movingAvg(data), [data])
  const labels = useMemo(() => dates.map((d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })), [dates])
  return (
    <div className="card wcard">
      <div className="wcard__h"><h3>{title}</h3><span className="wcard__now">{now ?? '—'}<small>{unit}</small></span></div>
      {vals.length ? <div className="wcard__sub">avg {avg}{unit} · min {Math.min(...vals)} · max {Math.max(...vals)}</div> : null}
      {vals.length >= 2
        ? <TrendChart height={130} axes labels={labels} unit={unit} series={[{ label: 'daily', color, data, faint: true }, { label: '7-day avg', color, data: mav }]} />
        : <p className="meta" style={{ margin: '8px 2px' }}>Not enough data in this range.</p>}
      {insight && <p className="fit-insight">{insight.emoji} {insight.text}{insight.tip ? <span className="meta"> · 💡 {insight.tip}</span> : null}</p>}
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

  // enough check-ins to draw?
  const drawn = [avgLines.sleep, avgLines.energy, avgLines.form, overallAvgLine]
  const all = drawn.flat().filter((v): v is number => v != null)
  if (all.length < 2 || !overallStat) return <p className="meta" style={{ margin: '8px 2px' }}>Not enough check-ins in this range.</p>

  const latest = (arr: (number | null)[]) => { const v = arr.filter((x): x is number => x != null); return v.length ? v[v.length - 1] : null }
  const focused = focus ? CB_METRICS.find((m) => m.key === focus)! : null
  const headTitle = focused ? focused.name : 'Check-in breakdown'
  const headNow = focused ? latest(avgLines[focus!]) : overallStat.avg
  const headColor = focused ? focused.color : 'var(--text)'
  // #395/#397 — the SHARED TrendChart (hover scrubber + tooltip showing every value on a day). Tap-to-focus now
  // dims the others via `faint`; the overall average stays dashed. Same standard as the metric charts above.
  const cbSeries = [
    ...CB_METRICS.map((m) => ({ label: m.name, color: m.color, data: avgLines[m.key], faint: !!focus && focus !== m.key })),
    { label: 'overall', color: CB_OVERALL_COLOR, data: overallAvgLine, dash: true },
  ]
  // coach insight on EVERY graph (JM 2026-07-07): overall readiness trend + the weakest lever to improve.
  const oVals = overallDaily.filter((v): v is number => v != null)
  let cbInsight: string | null = null
  if (oVals.length >= 4) {
    const h = Math.floor(oVals.length / 2)
    const dm = oVals.slice(h).reduce((a, b) => a + b, 0) / oVals.slice(h).length - oVals.slice(0, h).reduce((a, b) => a + b, 0) / oVals.slice(0, h).length
    const comp = CB_METRICS.map((m) => { const v = series[m.key].filter((x): x is number => x != null); return { m, a: v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN } }).filter((x) => !Number.isNaN(x.a))
    const weakest = comp.length ? comp.reduce((lo, x) => (x.a < lo.a ? x : lo)) : null
    const trend = Math.abs(dm) < 0.2 ? '➡️ Your daily readiness is holding steady.' : dm > 0 ? `📈 Readiness is trending up (+${dm.toFixed(1)}) — recovery is winning; keep it going.` : `📉 Readiness is sliding (${dm.toFixed(1)}) — bank more sleep or ease the load.`
    const lever = weakest && weakest.a < 3.2 ? ` ${weakest.m.emoji} ${weakest.m.name} is your lowest input (avg ${weakest.a.toFixed(1)}/5) — the biggest win is there.` : ''
    cbInsight = trend + lever
  }

  return (
    <div className="card wcard">
      <div className="wcard__h">
        <h3>📝 {headTitle} (1–5)</h3>
        <span className="wcard__now" style={{ color: headColor }}>{headNow ?? '—'}</span>
      </div>
      <div className="wcard__sub">Overall avg {overallStat.avg} · min {overallStat.min} · max {overallStat.max}{!focus ? ' — tap a metric to focus' : ''}</div>
      <TrendChart height={150} axes labels={dates} minSpan={2} series={cbSeries} />
      {cbInsight && <p className="fit-insight">{cbInsight}</p>}
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
          {/* #395 — each metric's coach insight now lives UNDER its own chart (consistent with the Fitness
              charts), so the separate combined "Coach insights" card is gone (was redundant). */}
          {connected && anyWellness && (
            <>
              <MetricCard title="😴 Sleep" data={view.sleep} dates={view.dates} color="#5ec8ff" unit="h" insight={insights.find((i) => i.metric === 'Sleep')} />
              <MetricCard title="💓 HRV" data={view.hrv} dates={view.dates} color="#34e07d" insight={insights.find((i) => i.metric === 'HRV')} />
              <MetricCard title="❤️ Resting HR" data={view.rhr} dates={view.dates} color="#ff8fb1" insight={insights.find((i) => i.metric === 'Resting HR')} />
              <MetricCard title="⚖️ Weight" data={view.weight} dates={view.dates} color="#f0b145" unit="kg" insight={insights.find((i) => i.metric === 'Weight')} />
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
