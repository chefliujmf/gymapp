import { useState } from 'react'
import { authApi } from './auth/api'
import { useAuth } from './auth/AuthContext'

// #303 — Profile → weekly availability (hours/day the athlete can train). Saved to the profile so the
// coach places sessions around it (no long ride on a 30-min day). Stored as info.availability.
const DAYS: [string, string][] = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
const OPTS: [string, number][] = [['Rest', 0], ['30m', 0.5], ['45m', 0.75], ['1h', 1], ['1h15', 1.25], ['1.5h', 1.5], ['2h', 2], ['3h+', 3]]
const MAXH = 4
type Avail = Record<string, number>

export default function Availability() {
  const { user, refresh } = useAuth()
  const [avail, setAvail] = useState<Avail>(() => ((user?.info as { availability?: Avail } | undefined)?.availability) || {})
  const [saved, setSaved] = useState(false)
  const set = (day: string, h: number) => {
    const next = { ...avail, [day]: h }
    setAvail(next)
    authApi.saveProfile({ availability: next }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); refresh().catch(() => {}) }).catch(() => {})
  }
  const total = DAYS.reduce((s, [k]) => s + (avail[k] || 0), 0)
  return (
    <>
      <div className="section-title">Weekly availability {saved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <p className="meta" style={{ margin: '2px 2px 8px' }}>Hours you can train each day — your coach places sessions around it.</p>
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
      <div style={{ marginTop: 8 }}>
        {DAYS.map(([k, d]) => (
          <div key={k} className="avail-row">
            <span className="avail-dname">{d}</span>
            <div className="chips" style={{ flex: 1 }}>
              {OPTS.map(([lab, v]) => <button key={lab} className={'chip avail-chip' + (v === 0 ? ' rest' : '') + ((avail[k] || 0) === v ? ' chip--active' : '')} onClick={() => set(k, v)}>{lab}</button>)}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
