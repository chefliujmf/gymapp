import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { localISO } from '../date'
import { fetchWellness, type IcuWellness } from '../intervals'
import { useAuth } from '../auth/AuthContext'
import { TrendChart, BarChart, InfoDot, ChartModal, type Series } from '../charts'
import { hasModule } from '../modules'
import { DateRangeFilter, TRAINING_PRESETS } from '../DateRange'

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
  const [rows, setRows] = useState<IcuWellness[] | null>(null)
  const [modal, setModal] = useState<{ title: string; node: ReactNode } | null>(null)
  const sports = user?.sports || []
  const isEndurance = hasModule(sports, 'endurance') // #198 central helper (empty = show all)

  useEffect(() => {
    if (!from || !to) return
    const [f, t] = from <= to ? [from, to] : [to, from] // forgiving: auto-swap reversed range
    setRows(null)
    fetchWellness(f, t).then(setRows).catch(() => setRows([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  const s = useMemo(() => {
    const r = rows || []
    const col = (k: keyof IcuWellness) => r.map((d) => d[k] as number | null)
    return { fitness: col('fitness'), fatigue: col('fatigue'), form: col('form'), load: col('load') }
  }, [rows])

  const fz = formZone(last(s.form))
  const dates = (rows || []).map((d) => new Date(d.date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))

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
                <button className="chart-expand" aria-label="Expand chart" onClick={() => setModal({ title: 'Fitness & Fatigue', node: <TrendChart height={Math.min(360, window.innerHeight * 0.5)} axes labels={dates} series={[{ label: 'Fitness', color: '#4aa3ff', data: s.fitness, area: true }, { label: 'Fatigue', color: '#c061ff', data: s.fatigue }]} /> })}>⤢</button>
                <div className="fit-legend"><span style={{ color: '#4aa3ff' }}>● Fitness</span><span style={{ color: '#c061ff' }}>● Fatigue</span></div>
                <TrendChart height={170} axes labels={dates} series={[
                  { label: 'Fitness', color: '#4aa3ff', data: s.fitness, area: true },
                  { label: 'Fatigue', color: '#c061ff', data: s.fatigue },
                ]} />
                <p className="fit-insight">{fitnessInsight(s.fitness)}</p>
              </div>

              <div className="card chart-card" style={{ padding: '12px 14px', marginTop: 12 }}>
                <button className="chart-expand" aria-label="Expand chart" onClick={() => setModal({ title: 'Form', node: <TrendChart height={Math.min(360, window.innerHeight * 0.5)} axes labels={dates} bands={FORM_BANDS} series={[{ label: 'Form', color: fz.color, data: s.form }]} /> })}>⤢</button>
                <div className="fit-legend"><span style={{ color: fz.color }}>● Form</span><span style={{ color: '#34e07d' }}>● optimal zone (−10…−30)</span></div>
                <TrendChart height={130} axes labels={dates} bands={FORM_BANDS} series={[{ label: 'Form', color: fz.color, data: s.form }]} />
                <p className="fit-insight">{formInsight(last(s.form))}</p>
              </div>

              <div className="fit-grid fit-grid--one">
                <MiniCard title="Training load / day" value={last(s.load)} hint="How hard each day was (TSS — duration × intensity). Taller bar = harder day." bars={s.load} color="#9b6bff" />
              </div>
              {/* sleep/HRV/resting-HR/weight moved to their own page (#194a) */}
              <Link to="/wellness" className="card hub-link" style={{ marginTop: 12 }}>
                <span className="hub-link__ic">❤️</span>
                <span className="hub-link__t"><h3>Wellness</h3><div className="meta">Sleep · HRV · resting HR · weight trends</div></span>
                <span className="hub-link__ch">›</span>
              </Link>
              <p className="meta" style={{ marginTop: 10 }}>All read live from intervals.icu — Platyplus doesn't store these. The number on each card is your most recent day.</p>
            </>
          )}
        </>
      )}
      {modal && <ChartModal title={modal.title} onClose={() => setModal(null)}>{modal.node}</ChartModal>}
    </div>
  )
}
