import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { localISO } from '../date'
import { fetchWellness, fetchPowerCurve, type IcuWellness, type PowerCurve } from '../intervals'
import { useAuth } from '../auth/AuthContext'
import { TrendChart, BarChart, PowerCurveChart, InfoDot, ChartModal, bestAt, type Series } from '../charts'

const ENDURANCE = ['cycling', 'running', 'triathlon']
const RANGES: [string, number][] = [['6 wk', 42], ['3 mo', 90], ['6 mo', 180], ['1 yr', 365]]
const last = (a: (number | null)[]) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i] as number; return null }
const fmt = (v: number | null, unit = '') => (v == null ? '—' : `${Math.round(v * 10) / 10}${unit}`)

function formZone(v: number | null) {
  if (v == null) return { label: '', color: 'var(--text-dim)' }
  if (v > 20) return { label: 'Transition', color: '#caa45a' }
  if (v > 5) return { label: 'Fresh', color: '#4aa3ff' }
  if (v > -10) return { label: 'Grey zone', color: '#9aa3b2' }
  if (v > -30) return { label: 'Optimal', color: '#34e07d' }
  return { label: 'High risk', color: '#ff5d5d' }
}

function MiniCard({ title, value, unit, hint, series, bars, color }: { title: string; value: number | null; unit?: string; hint?: string; series?: Series; bars?: (number | null)[]; color?: string }) {
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
  const [days, setDays] = useState(90)
  const [rows, setRows] = useState<IcuWellness[] | null>(null)
  const [pc, setPc] = useState<PowerCurve | null>(null)
  const [modal, setModal] = useState<{ title: string; node: ReactNode } | null>(null)
  const sports = user?.sports || []
  const isEndurance = !sports.length || sports.some((sp) => ENDURANCE.includes(sp))
  const isCycling = !sports.length || sports.some((sp) => ['cycling', 'triathlon'].includes(sp))

  useEffect(() => {
    setRows(null); setPc(null)
    const to = localISO(), from = localISO(new Date(Date.now() - days * 86400000))
    fetchWellness(from, to).then(setRows).catch(() => setRows([]))
    if (isCycling) fetchPowerCurve(days).then(setPc).catch(() => setPc(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const s = useMemo(() => {
    const r = rows || []
    const col = (k: keyof IcuWellness) => r.map((d) => d[k] as number | null)
    const fitness = col('fitness'), fatigue = col('fatigue'), form = col('form')
    const weight = col('weight'), eftp = col('eftp')
    // VO2max estimate (Coggan: 10.8·FTP/kg + 7) per day where both eFTP and weight exist.
    const vo2 = r.map((d) => (d.eftp && d.weight ? Math.round((10.8 * d.eftp / d.weight + 7) * 10) / 10 : null))
    return { fitness, fatigue, form, weight, eftp, vo2, hrv: col('hrv'), rhr: col('restingHR'), sleep: col('sleepHours'), load: col('load') }
  }, [rows])

  const fz = formZone(last(s.form))
  const dates = (rows || []).map((d) => new Date(d.date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Fitness</h1><p>Your form & trends, from intervals.icu</p></div>
      </div>

      {!isEndurance ? (
        <p className="meta">Fitness/Form tracking is for endurance sports (cycling, running, triathlon). Set your main sport in Profile.</p>
      ) : !user?.hasIcuKey ? (
        <p className="meta">Connect intervals.icu in <span style={{ color: 'var(--accent)' }}>Settings → Connections</span> to see your fitness trends.</p>
      ) : (
        <>
          <div className="chips" style={{ marginBottom: 12 }}>
            {RANGES.map(([label, d]) => <button key={d} className={'chip' + (days === d ? ' chip--active' : '')} onClick={() => setDays(d)}>{label}</button>)}
          </div>

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
              </div>

              <div className="card chart-card" style={{ padding: '12px 14px', marginTop: 12 }}>
                <button className="chart-expand" aria-label="Expand chart" onClick={() => setModal({ title: 'Form', node: <TrendChart height={Math.min(360, window.innerHeight * 0.5)} axes labels={dates} series={[{ label: 'Form', color: fz.color, data: s.form, area: true }]} /> })}>⤢</button>
                <div className="fit-legend"><span style={{ color: fz.color }}>● Form (Fitness − Fatigue)</span></div>
                <TrendChart height={120} axes labels={dates} series={[{ label: 'Form', color: fz.color, data: s.form, area: true }]} />
              </div>

              <div className="fit-grid">
                <MiniCard title="VO₂max (est.)" value={last(s.vo2)} hint="Aerobic engine size (ml/kg/min). Higher = fitter. Estimated from eFTP ÷ weight." series={{ label: '', color: '#34e07d', data: s.vo2, area: true }} />
                <MiniCard title="eFTP" value={last(s.eftp)} unit=" W" hint="Estimated threshold power — watts you can hold ~1 hour. Higher = stronger." series={{ label: '', color: '#ffb020', data: s.eftp }} />
                <MiniCard title="Weight" value={last(s.weight)} unit=" kg" hint="Body weight." series={{ label: '', color: '#e8e8ee', data: s.weight }} />
                <MiniCard title="HRV" value={last(s.hrv)} hint="Heart-rate variability (ms). Above your usual = recovered; a drop = fatigue/stress." series={{ label: '', color: '#ff6b9d', data: s.hrv, area: true }} />
                <MiniCard title="Resting HR" value={last(s.rhr)} unit=" bpm" hint="Resting heart rate. Lower than usual = recovered; a spike = tired/unwell." series={{ label: '', color: '#ff5d5d', data: s.rhr }} />
                <MiniCard title="Sleep" value={last(s.sleep)} unit=" h" hint="Hours slept per night." bars={s.sleep} color="#7a8cff" />
                <MiniCard title="Training load / day" value={last(s.load)} hint="How hard each day was (TSS — duration × intensity). Taller bar = harder day." bars={s.load} color="#9b6bff" />
              </div>
              {isCycling && pc && (
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
              )}
              <p className="meta" style={{ marginTop: 10 }}>All read live from intervals.icu — Platyplus doesn't store these. The number on each card is your most recent day.</p>
            </>
          )}
        </>
      )}
      {modal && <ChartModal title={modal.title} onClose={() => setModal(null)}>{modal.node}</ChartModal>}
    </div>
  )
}
