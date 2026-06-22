import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WorkoutLog, type SetEntry } from '../db'
import { e1rm } from '../strength'

const fmtDate = (d: string) => new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
function vol(sets: Record<number, SetEntry[]>) { let v = 0; for (const arr of Object.values(sets || {})) for (const s of arr || []) v += (s.weight || 0) * (s.reps || 0); return Math.round(v) }

function SessionCard({ log }: { log: WorkoutLog }) {
  const sets = log.sets || {}
  // Edit a set inline → save to the device and (if synced) the account.
  const save = async (exIdx: number, setIdx: number, patch: Partial<SetEntry>) => {
    const next: Record<number, SetEntry[]> = { ...sets }
    const arr = (next[exIdx] || []).slice()
    arr[setIdx] = { ...arr[setIdx], ...patch }
    next[exIdx] = arr
    const volume = vol(next)
    await db.logs.update(log.id!, { sets: next, volume })
    if (log.sid) fetch(`/auth/logs/${log.sid}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ sets: next, volume }) }).catch(() => {})
  }
  const exs = Object.entries(sets)
    .map(([idx, arr]) => ({ idx: Number(idx), name: log.exNames?.[Number(idx)] || `Exercise ${Number(idx) + 1}`, arr: (arr || []).filter((s) => s.weight || s.reps) }))
    .filter((e) => e.arr.length)
  if (!exs.length) return null
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div className="card-row" style={{ justifyContent: 'space-between' }}>
        <strong>{fmtDate(log.date)}</strong>
        <span className="meta">{log.duration} min · {vol(sets)} kg volume</span>
      </div>
      <div className="stack" style={{ gap: 12, marginTop: 8 }}>
        {exs.map((e) => {
          const best = Math.max(0, ...e.arr.map((s) => (s.weight && s.reps ? e1rm(s.weight, s.reps) : 0)))
          return (
            <div key={e.idx} className="log-ex">
              <div className="log-ex__name">{e.name}</div>
              {e.arr.map((s, si) => (
                <div key={si} className="log-set">
                  <span className="log-set__n">Set {si + 1}</span>
                  <input type="number" inputMode="decimal" value={s.weight ?? ''} onChange={(ev) => save(e.idx, si, { weight: ev.target.value === '' ? undefined : Number(ev.target.value) })} /> kg
                  <span className="log-set__x">×</span>
                  <input type="number" inputMode="numeric" value={s.reps ?? ''} onChange={(ev) => save(e.idx, si, { reps: ev.target.value === '' ? undefined : Number(ev.target.value) })} /> reps
                </div>
              ))}
              {best > 0 && <div className="log-best">Best 1RM: {Math.round(best)} kg</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Logs() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.logs.orderBy('date').reverse().toArray())
  const gym = (logs || []).filter((l) => l.sets && Object.keys(l.sets).length)
  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>History</h1><p>Your logged sessions — tap a number to fix it</p></div>
      </div>
      {logs === undefined ? <p className="meta">Loading…</p> : !gym.length ? <p className="meta">No gym sessions logged yet — log a workout and it'll show here.</p> : (
        <div className="stack">{gym.map((l) => <SessionCard key={l.id} log={l} />)}</div>
      )}
    </div>
  )
}
