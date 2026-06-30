import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { localISO } from '../date'
import { BarChart } from '../charts'
import { mindStats, isMindDiscipline } from '../mind-stats'

// #194c — Mind stats page: minutes / sessions / streak + weekly-minutes trend from logged sessions.
export default function MindStats() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.logs.toArray(), []) ?? null
  const mind = (logs ?? []).filter((l) => isMindDiscipline(l.discipline)).sort((a, b) => (a.date < b.date ? 1 : -1))
  const s = mindStats(mind.map((l) => ({ date: l.date, duration: l.duration })), localISO())

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Mind</h1><p>Meditation · yoga · pilates — minutes, sessions, streak</p></div>
      </div>

      {logs === null ? <p className="meta">Loading…</p> : !mind.length ? (
        <p className="meta">No mind sessions logged yet. Finish a session in <span style={{ color: 'var(--accent)' }}>Mind</span> and it'll show here.</p>
      ) : (
        <>
          <div className="mind-stat3">
            <div><b>{s.minutesMonth}</b><span>min this month</span></div>
            <div><b>{s.sessionsMonth}</b><span>sessions</span></div>
            <div><b>{s.streak}{s.streak ? ' 🔥' : ''}</b><span>day streak</span></div>
          </div>

          <div className="section-title">Minutes per week <span className="meta" style={{ fontWeight: 400 }}>· last 8 weeks</span></div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <BarChart data={s.weeklyMinutes} color="#9b8cff" height={90} />
          </div>

          <div className="section-title">Recent sessions</div>
          <div className="stack">
            {mind.slice(0, 8).map((l, i) => (
              <div key={l.id ?? i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px' }}>
                <span style={{ fontSize: 22 }}>🧘</span>
                <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 14 }}>{l.title}</strong><div className="meta">{new Date(l.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div></div>
                <span className="meta">{l.duration} min</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
