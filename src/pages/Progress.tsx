import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WorkoutLog, type SetEntry } from '../db'
import { disciplineIcon } from '../ui'
import type { Discipline } from '../types'

function startOfWeek() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Consecutive days with a logged session, ending today (1-day grace). */
function dayStreak(times: number[]): number {
  const days = new Set(times.map((t) => new Date(t).toISOString().slice(0, 10)))
  const d = new Date(); d.setHours(0, 0, 0, 0)
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1) // finished yesterday still counts today
  let streak = 0
  while (days.has(iso(d))) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

export default function Progress() {
  const logs = useLiveQuery(() => db.logs.orderBy('completedAt').reverse().toArray())
  const [open, setOpen] = useState<number | undefined>()

  if (!logs) return null

  const thisWeek = logs.filter((l) => l.completedAt >= startOfWeek())
  const totalMin = logs.reduce((s, l) => s + l.duration, 0)
  const weekMin = thisWeek.reduce((s, l) => s + l.duration, 0)
  const streak = dayStreak(logs.map((l) => l.completedAt))

  async function editSet(l: WorkoutLog, exi: number, si: number, patch: Partial<SetEntry>) {
    const sets: Record<number, SetEntry[]> = { ...(l.sets || {}) }
    const arr = (sets[exi] || []).slice()
    arr[si] = { ...arr[si], ...patch, done: true }
    sets[exi] = arr
    const volume = Object.values(sets).flat().reduce((v: number, s: SetEntry) => v + (s?.done ? (s.weight || 0) * (s.reps || 0) : 0), 0)
    if (l.id != null) await db.logs.update(l.id, { sets, volume })
  }

  return (
    <div>
      <div className="page-head">
        <h1>Progress</h1>
        <p>Everything you've logged, on this device</p>
      </div>

      {streak > 0 && (
        <div className="streak-banner">🔥 {streak}-day streak</div>
      )}

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
              <div className="card-row" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === l.id ? undefined : l.id)}>
                <div className="thumb" style={{ width: 52, height: 52, fontSize: 22 }}>
                  {disciplineIcon[l.discipline as Discipline] ?? '💪'}
                </div>
                <div className="card-body">
                  <h3 style={{ fontSize: 15 }}>{l.title}</h3>
                  <div className="meta">
                    <span>{new Date(l.completedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="dot">{l.duration} min</span>
                    {!!l.volume && <span className="dot">{l.volume} kg vol</span>}
                  </div>
                </div>
                <span style={{ opacity: 0.4 }}>{open === l.id ? '▾' : '›'}</span>
              </div>

              {open === l.id && (
                <div style={{ padding: '10px 4px 2px', borderTop: '1px solid var(--line,#eee)', marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className="mini">duration<input type="number" defaultValue={l.duration} onBlur={(e) => l.id && db.logs.update(l.id, { duration: Number(e.target.value) || 0 })} />min</label>
                  </div>
                  {l.sets && Object.keys(l.sets).length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {Object.entries(l.sets).map(([exi, sets]) => (
                        <div key={exi} style={{ marginBottom: 8 }}>
                          <div className="meta" style={{ marginBottom: 4 }}>Exercise {Number(exi) + 1}</div>
                          {sets.map((s, si) => (
                            <div key={si} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                              <span className="meta" style={{ width: 36 }}>set {si + 1}</span>
                              <input className="hist-in" type="number" defaultValue={s.weight ?? ''} placeholder="kg" onBlur={(e) => editSet(l, Number(exi), si, { weight: e.target.value === '' ? undefined : Number(e.target.value) })} />
                              <span>×</span>
                              <input className="hist-in" type="number" defaultValue={s.reps ?? ''} placeholder="reps" onBlur={(e) => editSet(l, Number(exi), si, { reps: e.target.value === '' ? undefined : Number(e.target.value) })} />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn btn--ghost" style={{ color: 'var(--danger,#c00)', marginTop: 6 }} onClick={() => l.id && confirm('Delete this entry?') && db.logs.delete(l.id)}>Delete entry</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
