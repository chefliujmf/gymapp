import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { disciplineIcon } from '../ui'
import type { Discipline } from '../types'

function startOfWeek() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export default function Progress() {
  const logs = useLiveQuery(() => db.logs.orderBy('completedAt').reverse().toArray())

  if (!logs) return null

  const thisWeek = logs.filter((l) => l.completedAt >= startOfWeek())
  const totalMin = logs.reduce((s, l) => s + l.duration, 0)
  const weekMin = thisWeek.reduce((s, l) => s + l.duration, 0)

  return (
    <div>
      <div className="page-head">
        <h1>Progress</h1>
        <p>Everything you've logged, on this device</p>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat"><div className="v">{thisWeek.length}</div><div className="k">this week</div></div>
        <div className="stat"><div className="v">{logs.length}</div><div className="k">all time</div></div>
        <div className="stat"><div className="v">{Math.round(totalMin / 60)}h</div><div className="k">total time</div></div>
      </div>
      <p className="meta" style={{ marginTop: 4 }}>{weekMin} minutes trained this week</p>

      <div className="section-title">History</div>
      {logs.length === 0 ? (
        <div className="empty">
          <div className="big">📈</div>
          No workouts logged yet.<br />Complete a session to see it here.
        </div>
      ) : (
        <ul className="plain stack">
          {logs.map((l) => (
            <li key={l.id} className="card">
              <div className="card-row">
                <div className="thumb" style={{ width: 52, height: 52, fontSize: 22 }}>
                  {disciplineIcon[l.discipline as Discipline] ?? '💪'}
                </div>
                <div className="card-body">
                  <h3 style={{ fontSize: 15 }}>{l.title}</h3>
                  <div className="meta">
                    <span>{new Date(l.completedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="dot">{l.duration} min</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
