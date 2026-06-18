import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db'
import { fetchAthleteFtp, fetchEvents, getIcuConfig, setIcuConfig } from '../intervals'
import { localISO } from '../date'

function weekRange(): [string, string] {
  const now = new Date()
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const iso = localISO
  return [iso(mon), iso(sun)]
}

export default function Profile() {
  const logs = useLiveQuery(() => db.logs.toArray())
  const units = useLiveQuery(() => getSetting('units'))
  const diet = useLiveQuery(() => getSetting('diet'))
  const ftp = useLiveQuery(() => getSetting('ftp'))
  const icu = useLiveQuery(() => getIcuConfig())

  const [key, setKey] = useState('')
  const [athlete, setAthlete] = useState('')
  const [status, setStatus] = useState('')

  const totalMin = (logs ?? []).reduce((s, l) => s + l.duration, 0)

  async function saveIcu() {
    await setIcuConfig(key || icu?.apiKey || '', athlete || icu?.athleteId)
    setStatus('Saved. Testing…')
    try {
      const [a, b] = weekRange()
      const ev = await fetchEvents(a, b)
      const f = await fetchAthleteFtp()
      if (f) await setSetting('ftp', String(f))
      setStatus(`✓ Connected — ${ev.length} events this week${f ? ` · FTP ${f}W` : ''}`)
    } catch (e) {
      setStatus(`✗ ${(e as Error).message === 'NO_KEY' ? 'No key set' : 'Connection failed: ' + (e as Error).message}`)
    }
  }

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

      <div className="section-title">Training plan (intervals.icu)</div>
      <p className="meta" style={{ marginTop: -4 }}>Connect your coach's plan. Read-only — Today shows what's scheduled.</p>
      <input className="search" type="password" placeholder={icu?.apiKey ? '•••••• (saved)' : 'API key'} value={key} onChange={(e) => setKey(e.target.value)} />
      <input className="search" placeholder={`Athlete id (${icu?.athleteId ?? 'i28814'})`} value={athlete} onChange={(e) => setAthlete(e.target.value)} />
      <button className="btn" onClick={saveIcu}>Save & sync from intervals.icu</button>
      {status && <p className="meta" style={{ marginTop: 8 }}>{status}</p>}
      <p className="meta" style={{ marginTop: 8 }}>
        Your athlete metrics come from intervals.icu — <b>FTP {ftp ?? '—'}{ftp ? 'W' : ''}</b> (scales cycling power),
        and weight / sleep / wellness sync from there too. Nothing to type here.
      </p>

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
        Clear all data on this device
      </button>
      <p className="meta" style={{ marginTop: 10 }}>All your logs and progress are stored only on this device.</p>
    </div>
  )
}
