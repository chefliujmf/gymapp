import { useState } from 'react'
import { authApi } from './auth/api'
import { useAuth } from './auth/AuthContext'

// #303/#322 — Profile → weekly availability (hours/day). Stored as info.availability. #322: DENSE —
// one compact slider per day instead of 7×8 big chips. #316: also capture desired training FREQUENCY
// (days/week) → the coach plans that many BASE sessions and offers extras as optional/bonus.
const DAYS: [string, string][] = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
const STEPS = [0, 0.5, 0.75, 1, 1.25, 1.5, 2, 3] // hours each slider notch maps to
const LABELS = ['Rest', '30m', '45m', '1h', '1h15', '1.5h', '2h', '3h+']
const MAXH = 4
type Avail = Record<string, number>
const idxOf = (h: number) => { const i = STEPS.indexOf(h); return i >= 0 ? i : 0 }

export default function Availability() {
  const { user, refresh } = useAuth()
  const info = (user?.info || {}) as { availability?: Avail; trainingDays?: number; maxPerDay?: number }
  const [avail, setAvail] = useState<Avail>(() => info.availability || {})
  const [days, setDays] = useState<number>(() => info.trainingDays || 0)
  const [maxPerDay, setMaxPerDay] = useState<number>(() => info.maxPerDay || 1) // #345 default: ONE session/day
  const [saved, setSaved] = useState(false)
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  const set = (day: string, h: number) => {
    const next = { ...avail, [day]: h }; setAvail(next)
    authApi.saveProfile({ availability: next }).then(() => { flash(); refresh().catch(() => {}) }).catch(() => {})
  }
  const setFreq = (n: number) => { setDays(n); authApi.saveProfile({ trainingDays: n }).then(() => { flash(); refresh().catch(() => {}) }).catch(() => {}) }
  const setMax = (n: number) => { setMaxPerDay(n); authApi.saveProfile({ maxPerDay: n }).then(() => { flash(); refresh().catch(() => {}) }).catch(() => {}) }
  const total = DAYS.reduce((s, [k]) => s + (avail[k] || 0), 0)

  return (
    <>
      <div className="section-title" id="ob-avail">Weekly availability {saved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>

      {/* #316/#454 — max training days/week. A HARD CAP (JM directive): the coach plans UP TO this many
          days and NEVER more (enforced server-side). A free NUMBER field, not fixed chips (#316b). */}
      <p className="meta" style={{ margin: '2px 2px 6px' }}>Most days a week you want to train?</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <input type="number" inputMode="numeric" min={0} max={14} value={days || ''} placeholder="e.g. 4"
          className="search" style={{ maxWidth: 92, textAlign: 'center' }}
          onChange={(e) => setFreq(Math.max(0, Math.min(14, Math.round(Number(e.target.value) || 0))))} />
        <span className="meta">days / week</span>
      </div>
      <p className="meta" style={{ margin: '0 2px 10px', opacity: .8, fontSize: 12 }}>A hard cap — your coach plans up to this many days, never more.</p>

      {/* #345 — most people train ONCE a day; the coach must not stack a gym + a run on the same day
          unless you say you can double. Default 1. */}
      <p className="meta" style={{ margin: '2px 2px 6px' }}>How many sessions per day, at most?</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <input type="number" inputMode="numeric" min={1} max={4} value={maxPerDay}
          className="search" style={{ maxWidth: 92, textAlign: 'center' }}
          onChange={(e) => setMax(Math.max(1, Math.min(4, Math.round(Number(e.target.value) || 1))))} />
        <span className="meta">session{maxPerDay > 1 ? 's' : ''} / day{maxPerDay === 1 ? ' — one training a day' : ' (e.g. AM + PM)'}</span>
      </div>

      <p className="meta" style={{ margin: '2px 2px 8px' }}>And how long each day? Your coach fits sessions around it{days ? ` — up to ${days} day${days > 1 ? 's' : ''}/week` : ''}.</p>
      <div className="card avail-card">
        <div className="avail-week">
          {DAYS.map(([k, d]) => { const h = avail[k] || 0; return (
            <div key={k} className="avail-col">
              <div className={'avail-bar' + (h === 0 ? ' rest' : '')} style={{ height: `${Math.max(3, (h / MAXH) * 100)}%` }}>{h > 0 && <b>{h}h</b>}</div>
              <span>{d[0]}</span>
            </div>
          ) })}
        </div>
        <div className="avail-total"><span className="lab">Total / week</span><b>{total}<small> h</small></b></div>
      </div>

      {/* #322 dense: one slider row per day (was 7 rows × 8 big chips) */}
      <div className="avail-sliders">
        {DAYS.map(([k, d]) => {
          const h = avail[k] || 0; const i = idxOf(h)
          return (
            <div key={k} className="avail-srow">
              <span className="avail-dname">{d}</span>
              <input type="range" min={0} max={STEPS.length - 1} step={1} value={i} className="avail-slider"
                onChange={(e) => set(k, STEPS[Number(e.target.value)])} aria-label={`${d} training time`} />
              <span className={'avail-val' + (h === 0 ? ' rest' : '')}>{LABELS[i]}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
