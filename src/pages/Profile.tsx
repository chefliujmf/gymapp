import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db'

export default function Profile() {
  const logs = useLiveQuery(() => db.logs.toArray())
  const embyUrl = useLiveQuery(() => getSetting('embyBaseUrl'))
  const units = useLiveQuery(() => getSetting('units'))

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
        <div className="stat"><div className="v">∞</div><div className="k">streak</div></div>
      </div>

      <Link to="/progress" className="btn btn--ghost" style={{ marginTop: 6 }}>📈 View full progress</Link>

      <div className="section-title">Video source (Emby)</div>
      <p className="meta" style={{ marginTop: -4 }}>Base URL of your Emby server so workouts can stream video.</p>
      <input
        className="field"
        placeholder="http://10.0.0.182:8096"
        defaultValue={embyUrl ?? ''}
        onBlur={(e) => setSetting('embyBaseUrl', e.target.value.trim())}
      />

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
        Clear all data on this device
      </button>
      <p className="meta" style={{ marginTop: 10 }}>All your logs and progress are stored only on this device.</p>
    </div>
  )
}
