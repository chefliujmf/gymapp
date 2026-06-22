import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db'
import { authApi } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { fetchAthleteSex } from '../intervals'

const SPORTS: [string, string][] = [['cycling', 'Cycling'], ['running', 'Running'], ['triathlon', 'Triathlon'], ['strength', 'Strength'], ['swimming', 'Swimming'], ['yoga', 'Yoga'], ['general', 'General']]

export default function Profile() {
  const { user, refresh } = useAuth()
  const logs = useLiveQuery(() => db.logs.toArray())
  const ftp = useLiveQuery(() => getSetting('ftp'))
  const coachName = useLiveQuery(() => getSetting('coachName'))
  const [coachSaved, setCoachSaved] = useState(false)
  const [sportSaved, setSportSaved] = useState(false)

  // Sex isn't asked here — read it from intervals.icu (if connected) to gate the
  // female-athlete coaching module. Optional: gating falls back without it.
  useEffect(() => {
    if (user && !user.sex && user.hasIcuKey) {
      fetchAthleteSex().then((s) => { if (s) authApi.saveProfile({ sex: s }).then(() => refresh()).catch(() => {}) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sex, user?.hasIcuKey])

  const toggleSport = (v: string) => {
    const cur = user?.sports || []
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    authApi.saveProfile({ sports: next }).then(() => { refresh(); setSportSaved(true); setTimeout(() => setSportSaved(false), 1500) }).catch(() => {})
  }
  const totalMin = (logs ?? []).reduce((s, l) => s + l.duration, 0)
  const avatar = user?.avatar
    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
    : (user?.username || '?').slice(0, 2).toUpperCase()

  return (
    <div>
      <div className="page-head"><h1>Profile</h1><p>You & your coaching</p></div>

      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="card-row" style={{ gap: 12, alignItems: 'center' }}>
          <span className="acct__avatar acct__avatar--lg">{avatar}</span>
          <div style={{ flex: 1 }}><strong>{user?.username}</strong><div className="meta">{user?.email} · {user?.role}</div></div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12 }}>
        <div className="stat"><div className="v">{logs?.length ?? 0}</div><div className="k">workouts</div></div>
        <div className="stat"><div className="v">{Math.round(totalMin / 60)}h</div><div className="k">trained</div></div>
        <div className="stat"><div className="v">{ftp ?? 260}</div><div className="k">FTP (W)</div></div>
      </div>
      <Link to="/progress" className="btn btn--ghost" style={{ marginTop: 6 }}>📈 View full progress</Link>
      <Link to="/stats" className="btn btn--ghost" style={{ marginTop: 6 }}>📊 Stats — fitness, strength & progress ›</Link>

      <div className="section-title">Your coach {coachSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <input
        className="search" placeholder="e.g. Tadej" value={coachName ?? ''}
        onChange={(e) => { setSetting('coachName', e.target.value); setCoachSaved(false) }}
        onBlur={(e) => { authApi.saveProfile({ coachName: e.target.value.trim() }).then(() => { setCoachSaved(true); setTimeout(() => setCoachSaved(false), 2500) }).catch(() => {}) }}
      />
      <p className="meta" style={{ margin: '6px 2px 4px' }}>What your coach goes by in chat — saved when you tap away.</p>
      <Link to="/profile/athlete" className="btn btn--ghost" style={{ marginTop: 8 }}>🏷️ Athlete profile — what your coach knows about you ›</Link>

      <div className="section-title">Sports you do {sportSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <div className="chips">
        {SPORTS.map(([v, label]) => (
          <button key={v} className={'chip' + ((user?.sports || []).includes(v) ? ' chip--active' : '')} onClick={() => toggleSport(v)}>{label}</button>
        ))}
      </div>
      <p className="meta" style={{ margin: '6px 2px 4px' }}>Pick all that apply — tunes your nav & coach. Cycling/Triathlon/Running unlock the endurance method & Fitness page.</p>

      <div className="section-title">App</div>
      <Link to="/settings" className="btn btn--ghost">⚙️ Settings — account, connections & preferences ›</Link>
    </div>
  )
}
