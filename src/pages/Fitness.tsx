import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { localISO } from '../date'
import { fetchWellness, type IcuWellness } from '../intervals'
import { useAuth } from '../auth/AuthContext'
import { TrendChart, BarChart, InfoDot, ChartModal, type Series } from '../charts'
import { hasModule } from '../modules'
import { DateRangeFilter, TRAINING_PRESETS } from '../DateRange'
import { authApi } from '../auth/api'

// #248 — small avg·min·max line for a chart series
const statLine = (a: (number | null)[]): string => { const v = a.filter((x): x is number => x != null); return v.length ? `avg ${Math.round(v.reduce((s, b) => s + b, 0) / v.length)} · min ${Math.round(Math.min(...v))} · max ${Math.round(Math.max(...v))}` : '' }

export const last = (a: (number | null)[]) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i] as number; return null }
const fmt = (v: number | null, unit = '') => (v == null ? '—' : `${Math.round(v * 10) / 10}${unit}`)

function formZone(v: number | null) {
  if (v == null) return { label: '', color: 'var(--text-dim)' }
  if (v > 20) return { label: 'Transition', color: '#caa45a' }
  if (v > 5) return { label: 'Fresh', color: '#4aa3ff' }
  if (v > -10) return { label: 'Grey zone', color: '#9aa3b2' }
  if (v > -30) return { label: 'Optimal', color: '#34e07d' }
  return { label: 'High risk', color: '#ff5d5d' }
}
// Form zone bands (intervals.icu): green Optimal (−10..−30) = productive training.
const FORM_BANDS = [
  { from: 25, to: 999, color: '#caa45a' },
  { from: 5, to: 25, color: '#4aa3ff' },
  { from: -10, to: 5, color: '#9aa3b2' },
  { from: -30, to: -10, color: '#34e07d' },
  { from: -999, to: -30, color: '#ff5d5d' },
]
const firstLast = (a: (number | null)[]): [number | null, number | null] => { let f: number | null = null, l: number | null = null; for (const v of a) if (v != null) { if (f == null) f = v; l = v } return [f, l] }
// Short coach-voice takeaways.
function fitnessInsight(fitness: (number | null)[]): string {
  const [f0, f1] = firstLast(fitness)
  if (f0 == null || f1 == null) return ''
  const d = Math.round(f1 - f0)
  if (d > 1) return `📈 Fitness is climbing (+${d} this range) — your consistency is paying off.`
  if (d < -1) return `📉 Fitness is sliding (${d}) — add some load to rebuild.`
  return `➡️ Fitness is steady — a maintenance block.`
}
function loadInsight(load: (number | null)[]): string {
  const v = load.filter((x): x is number => x != null)
  if (!v.length) return ''
  const avg = Math.round(v.reduce((a, b) => a + b, 0) / v.length)
  const recent = v.slice(-7), older = v.slice(-14, -7)
  const ra = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
  const oa = older.length ? older.reduce((a, b) => a + b, 0) / older.length : 0
  const trend = oa && ra > oa * 1.15 ? ' — ramping up this week' : oa && ra < oa * 0.85 ? ' — easing off this week' : ''
  return `🔥 ~${avg} TSS/day on average, peaking at ${Math.max(...v)}${trend}.`
}
function formInsight(form: number | null): string {
  const z = formZone(form).label
  if (z === 'Optimal') return `💪 Optimal zone — you're training productively and gaining fitness.`
  if (z === 'Fresh') return `✅ Fresh & race-ready — great for a key event, less so for building.`
  if (z === 'High risk') return `🛑 Deep fatigue — prioritise recovery before the next hard session.`
  if (z === 'Transition') return `😴 Very rested — you may be losing fitness; time to add training.`
  return `➡️ Maintenance — add stress to keep progressing.`
}

export function MiniCard({ title, value, unit, hint, series, bars, color }: { title: string; value: number | null; unit?: string; hint?: string; series?: Series; bars?: (number | null)[]; color?: string }) {
  const [hv, setHv] = useState<number | null>(null)
  const data = bars || series?.data || []
  const shown = hv != null && data[hv] != null ? (data[hv] as number) : value
  return (
    <div className="fit-mini">
      <div className="fit-mini__head"><span>{title}{hint && <InfoDot text={hint} />}</span><b style={hv != null ? { color: 'var(--accent, #34e07d)' } : undefined}>{fmt(shown, unit)}</b></div>
      {bars ? <BarChart data={bars} color={color} height={56} onHover={setHv} /> : series ? <TrendChart series={[series]} height={56} pad={6} onHover={setHv} /> : null}
    </div>
  )
}

export default function Fitness() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [from, setFrom] = useState(localISO(new Date(Date.now() - 90 * 86400000)))
  const [to, setTo] = useState(localISO())
  const [rawRows, setRawRows] = useState<IcuWellness[] | null>(null)
  // #376 — trim trailing days that have no CTL/ATL yet. intervals can return the freshest day(s) — or a
  // range ending "today" before it has finalised them — with NULL fitness/fatigue; those null tail-rows
  // then sit BETWEEN the solid history and the dashed projection, showing as a visible GAP ("the line
  // stops and restarts"). End the history at its last REAL point so the projection joins seamlessly.
  const rows = useMemo(() => {
    if (rawRows == null) return null
    let e = rawRows.length
    while (e > 0 && rawRows[e - 1].fitness == null && rawRows[e - 1].fatigue == null) e--
    return rawRows.slice(0, e)
  }, [rawRows])
  const [proj, setProj] = useState<Awaited<ReturnType<typeof authApi.readinessProjection>> | null>(null) // #248
  const [modal, setModal] = useState<{ title: string; node: ReactNode } | null>(null)
  const sports = user?.sports || []
  const isEndurance = hasModule(sports, 'endurance') // #198 central helper (empty = show all)

  useEffect(() => {
    if (!from || !to) return
    const [f, t] = from <= to ? [from, to] : [to, from] // forgiving: auto-swap reversed range
    setRawRows(null)
    fetchWellness(f, t).then(setRawRows).catch(() => setRawRows([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])
  useEffect(() => { if (isEndurance && user?.hasIcuKey) authApi.readinessProjection(28).then(setProj).catch(() => {}) }, [isEndurance, user?.hasIcuKey]) // #391 — 4-week forecast

  const s = useMemo(() => {
    const r = rows || []
    const col = (k: keyof IcuWellness) => r.map((d) => d[k] as number | null)
    return { fitness: col('fitness'), fatigue: col('fatigue'), form: col('form'), load: col('load') }
  }, [rows])

  const fz = formZone(last(s.form))
  const pastDates = (rows || []).map((d) => new Date(d.date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
  // #248: append a dashed forward PROJECTION (from planned load) to the Fitness/Fatigue + Form charts.
  const projOn = !!(proj?.available && proj.ctl?.length)
  const fut = projOn ? proj!.dates!.map((d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) : []
  const dates = [...pastDates, ...fut]
  // #376 — EVERY chart draws history+projection as ONE continuous solid+area line (`full`): history values
  // then the projected tail (Fitness←ctl, Fatigue←atl, Form←form, Load←planned loads). No split series, no
  // dashed overlay → a gap is structurally impossible, and all four charts share the SAME x-axis (they all
  // have the same length now, so the axis + the "today" divider line up across them — the Load chart used to
  // stop at today while the others ran to +14d, which read as a gap/mismatch vs the To date).
  const full = (a: (number | null)[], p?: number[]) => (projOn && p ? [...a, ...p] : a)
  // frac of "today" (the last real point) so each chart draws a divider + shades the projected tail.
  const todayFrac = projOn && dates.length > 1 ? (pastDates.length - 1) / (dates.length - 1) : undefined

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Load &amp; Form</h1><p>Whole-body training load &amp; freshness, from intervals.icu</p></div>
      </div>

      {!isEndurance ? (
        <p className="meta">Load &amp; Form tracking is for endurance sports (cycling, running, triathlon). Set your main sport in Profile.</p>
      ) : !user?.hasIcuKey ? (
        <p className="meta">Connect intervals.icu in <span style={{ color: 'var(--accent)' }}>Profile</span> to see your load &amp; form.</p>
      ) : (
        <>
          <DateRangeFilter presets={TRAINING_PRESETS} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />

          {rows === null ? <p className="meta">Loading…</p> : !rows.length ? <p className="meta">No fitness data in this range.</p> : (
            <>
              <p className="meta" style={{ margin: '0 2px 10px' }}>Showing your <b>latest</b> value on each card — tap any chart to scrub past days.</p>
              <div className="fit-head">
                <div className="fit-head__stat"><span>Fitness<InfoDot text="Your built-up fitness — a 6-week rolling average of training load (CTL). Climbs slowly as you train consistently; higher = fitter." /></span><b style={{ color: '#4aa3ff' }}>{fmt(last(s.fitness))}</b></div>
                <div className="fit-head__stat"><span>Fatigue<InfoDot text="Recent tiredness — your last-7-days training load (ATL). Rises fast after hard days, falls when you rest." /></span><b style={{ color: '#c061ff' }}>{fmt(last(s.fatigue))}</b></div>
                <div className="fit-head__stat"><span>Form<InfoDot text="Freshness = Fitness − Fatigue. Positive = fresh/tapered (race-ready). Negative = fatigued, which is normal while building. Very negative = back off." /></span><b style={{ color: fz.color }}>{fmt(last(s.form))}</b><em style={{ color: fz.color }}>{fz.label}</em></div>
              </div>

              <div className="card chart-card" style={{ padding: '12px 14px' }}>
                <button className="chart-expand" aria-label="Expand chart" onClick={() => setModal({ title: 'Fitness & Fatigue', node: <TrendChart height={Math.min(360, window.innerHeight * 0.5)} axes labels={dates} today={todayFrac} series={[{ label: 'Fitness', color: '#4aa3ff', data: full(s.fitness, proj?.ctl), area: true }, { label: 'Fatigue', color: '#c061ff', data: full(s.fatigue, proj?.atl) }]} /> })}>⤢</button>
                <div className="fit-legend"><span style={{ color: '#4aa3ff' }}>● Fitness</span><span style={{ color: '#c061ff' }}>● Fatigue</span>{projOn && <span className="meta">▒ projected →</span>}</div>
                <TrendChart height={170} axes labels={dates} today={todayFrac} series={[
                  { label: 'Fitness', color: '#4aa3ff', data: full(s.fitness, proj?.ctl), area: true },
                  { label: 'Fatigue', color: '#c061ff', data: full(s.fatigue, proj?.atl) },
                ]} />
                <p className="fit-insight">{fitnessInsight(s.fitness)} <span className="meta">· Fitness {statLine(s.fitness)}</span></p>
              </div>

              <div className="card chart-card" style={{ padding: '12px 14px', marginTop: 12 }}>
                <button className="chart-expand" aria-label="Expand chart" onClick={() => setModal({ title: 'Form', node: <TrendChart height={Math.min(360, window.innerHeight * 0.5)} axes labels={dates} today={todayFrac} bands={FORM_BANDS} series={[{ label: 'Form', color: 'var(--text)', data: full(s.form, proj?.form) }]} /> })}>⤢</button>
                <div className="fit-legend"><span style={{ color: fz.color }}>● Form</span><span style={{ color: '#34e07d' }}>● optimal zone</span>{projOn && <span className="meta">▒ projected →</span>}</div>
                <TrendChart height={130} axes labels={dates} today={todayFrac} bands={FORM_BANDS} series={[{ label: 'Form', color: 'var(--text)', data: full(s.form, proj?.form) }]} />
                <p className="fit-insight">{formInsight(last(s.form))} <span className="meta">· Form {statLine(s.form)}</span>{projOn && proj!.form!.length ? <span className="meta"> · projected → {proj!.form![proj!.form!.length - 1]} in {fut.length}d <InfoDot text="Forecast from your planned sessions (~2 wks); past that it follows your training plan's weekly load targets (your intervals ATP — build/overload/recovery), spread across your usual training days." /></span> : null}</p>
              </div>

              <div className="card chart-card" style={{ padding: '12px 14px', marginTop: 12 }}>
                <button className="chart-expand" aria-label="Expand chart" onClick={() => setModal({ title: 'Training load / day', node: <TrendChart height={Math.min(360, window.innerHeight * 0.5)} axes labels={dates} today={todayFrac} series={[{ label: 'Load', color: '#9b6bff', data: full(s.load, proj?.loads), area: true }]} /> })}>⤢</button>
                <div className="fit-legend"><span style={{ color: '#9b6bff' }}>● Training load / day<InfoDot text="How hard each day was — TSS (duration × intensity). Higher = harder day." /></span></div>
                <TrendChart height={130} axes labels={dates} today={todayFrac} series={[{ label: 'Load', color: '#9b6bff', data: full(s.load, proj?.loads), area: true }]} />
                <p className="fit-insight">{loadInsight(s.load)}</p>
              </div>
              {/* #420 — Wellness link removed from Load & Form (JM); Wellness lives in its own nav entry. */}
              <p className="meta" style={{ marginTop: 10 }}>All read live from intervals.icu — Platyplus doesn't store these. The number on each card is your most recent day.</p>
            </>
          )}
        </>
      )}
      {modal && <ChartModal title={modal.title} onClose={() => setModal(null)}>{modal.node}</ChartModal>}
    </div>
  )
}
