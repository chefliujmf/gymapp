import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db'
import AccountSection from '../auth/AccountSection'

export default function Profile() {
  const logs = useLiveQuery(() => db.logs.toArray())
  const units = useLiveQuery(() => getSetting('units'))
  const diet = useLiveQuery(() => getSetting('diet'))
  const ftp = useLiveQuery(() => getSetting('ftp'))

  const totalMin = (logs ?? []).reduce((s, l) => s + l.duration, 0)

  async function clearData() {
    if (!confirm('Clear all logs and progress on this device? This cannot be undone.')) return
    await db.logs.clear()
    await db.enrollments.clear()
    await db.activeSession.clear()
  }

  return (
    <div>
      <div className="page-head">
        <h1>Profile</h1>
        <p>Settings & your training data</p>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat"><div className="v">{logs?.length ?? 0}</div><div className="k">workouts</div></div>
        <div className="stat"><div className="v">{Math.round(totalMin / 60)}h</div><div className="k">trained</div></div>
        <div className="stat"><div className="v">{ftp ?? 260}</div><div className="k">FTP (W)</div></div>
      </div>

      <Link to="/progress" className="btn btn--ghost" style={{ marginTop: 6 }}>📈 View full progress</Link>

      <AccountSection />

      <div className="section-title">Diet</div>
      <div className="chips">
        {['vegetarian', 'vegan', 'no preference'].map((d) => (
          <button key={d} className={'chip' + ((diet ?? 'vegetarian') === d ? ' chip--active' : '')} onClick={() => setSetting('diet', d)}>
            {d}
          </button>
        ))}
      </div>

      <div className="section-title">Units</div>
      <div className="chips">
        {['metric', 'imperial'].map((u) => (
          <button key={u} className={'chip' + ((units ?? 'metric') === u ? ' chip--active' : '')} onClick={() => setSetting('units', u)}>
            {u}
          </button>
        ))}
      </div>

      <div className="section-title">Data</div>
      <button className="btn btn--ghost" style={{ color: 'var(--danger)' }} onClick={clearData}>
        Clear cached data on this device
      </button>
    </div>
  )
}
