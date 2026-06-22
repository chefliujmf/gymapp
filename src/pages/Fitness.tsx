import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { localISO } from '../date'
import { fetchWellness, type IcuWellness } from '../intervals'
import { useAuth } from '../auth/AuthContext'
import { TrendChart, BarChart, type Series } from '../charts'

const ENDURANCE = ['cycling', 'running', 'triathlon']
const RANGES: [string, number][] = [['6 weeks', 42], ['3 months', 90], ['1 year', 365]]
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

function MiniCard({ title, value, unit, series, bars, color }: { title: string; value: number | null; unit?: string; series?: Series; bars?: (number | null)[]; color?: string }) {
  return (
    <div className="fit-mini">
      <div className="fit-mini__head"><span>{title}</span><b>{fmt(value, unit)}</b></div>
      {bars ? <BarChart data={bars} color={color} height={56} /> : series ? <TrendChart series={[series]} height={56} pad={6} /> : null}
    </div>
  )
}

export default function Fitness() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [days, setDays] = useState(90)
  const [rows, setRows] = useState<IcuWellness[] | null>(null)
  const isEndurance = !user?.sport || ENDURANCE.includes(user.sport)

  useEffect(() => {
    setRows(null)
    const to = localISO(), from = localISO(new Date(Date.now() - days * 86400000))
    fetchWellness(from, to).then(setRows).catch(() => setRows([]))
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
              <div className="fit-head">
                <div className="fit-head__stat"><span>Fitness</span><b style={{ color: '#4aa3ff' }}>{fmt(last(s.fitness))}</b></div>
                <div className="fit-head__stat"><span>Fatigue</span><b style={{ color: '#c061ff' }}>{fmt(last(s.fatigue))}</b></div>
                <div className="fit-head__stat"><span>Form</span><b style={{ color: fz.color }}>{fmt(last(s.form))}</b><em style={{ color: fz.color }}>{fz.label}</em></div>
              </div>

              <div className="card" style={{ padding: '12px 14px' }}>
                <div className="fit-legend"><span style={{ color: '#4aa3ff' }}>● Fitness</span><span style={{ color: '#c061ff' }}>● Fatigue</span></div>
                <TrendChart height={170} series={[
                  { label: 'Fitness', color: '#4aa3ff', data: s.fitness, area: true },
                  { label: 'Fatigue', color: '#c061ff', data: s.fatigue },
                ]} />
              </div>

              <div className="card" style={{ padding: '12px 14px', marginTop: 12 }}>
                <div className="fit-legend"><span style={{ color: fz.color }}>● Form (Fitness − Fatigue)</span></div>
                <TrendChart height={120} series={[{ label: 'Form', color: fz.color, data: s.form, area: true }]} />
              </div>

              <div className="fit-grid">
                <MiniCard title="VO₂max (est.)" value={last(s.vo2)} series={{ label: '', color: '#34e07d', data: s.vo2, area: true }} />
                <MiniCard title="eFTP" value={last(s.eftp)} unit=" W" series={{ label: '', color: '#ffb020', data: s.eftp }} />
                <MiniCard title="Weight" value={last(s.weight)} unit=" kg" series={{ label: '', color: '#e8e8ee', data: s.weight }} />
                <MiniCard title="HRV" value={last(s.hrv)} series={{ label: '', color: '#ff6b9d', data: s.hrv, area: true }} />
                <MiniCard title="Resting HR" value={last(s.rhr)} unit=" bpm" series={{ label: '', color: '#ff5d5d', data: s.rhr }} />
                <MiniCard title="Sleep" value={last(s.sleep)} unit=" h" bars={s.sleep} color="#7a8cff" />
                <MiniCard title="Daily load" value={last(s.load)} bars={s.load} color="#9b6bff" />
              </div>
              <p className="meta" style={{ marginTop: 10 }}>VO₂max is estimated from eFTP ÷ weight (Coggan). Data is read live from intervals.icu.</p>
            </>
          )}
        </>
      )}
    </div>
  )
}
