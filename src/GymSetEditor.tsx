import { useState } from 'react'
import { db, getSetting, type WorkoutLog, type SetEntry } from './db'
import { useLiveQuery } from 'dexie-react-hooks'
import { e1rm } from './strength'

// #591 — POST-WORKOUT edit: fix a completed gym session's sets (mistyped weight/rep) from the result page,
// reusing the in-workout JeFit grid look. Recomputes volume/setsCompleted and saves both locally (Dexie) and
// to the server (PUT /auth/logs/:sid) — the SAME persistence History uses (Logs.tsx), so it's the one source of
// truth. onSaved hands the new sets back so the parent's summary (volume/1RM/PRs) recomputes live.
const LB = 2.2046226
export default function GymSetEditor({ log, exNames, onSaved }: { log: WorkoutLog; exNames: string[]; onSaved?: (sets: Record<number, SetEntry[]>) => void }) {
  const imp = (useLiveQuery(() => getSetting('units')) as string | undefined) === 'imperial'
  const unit = imp ? 'lb' : 'kg'
  const toDisp = (kg?: number) => kg == null ? '' : String(imp ? Math.round(kg * LB * 10) / 10 : kg)
  const fromDisp = (v: number) => imp ? v / LB : v
  const [sets, setSets] = useState<Record<number, SetEntry[]>>(() => JSON.parse(JSON.stringify(log.sets || {})))
  const [saved, setSaved] = useState(false)
  const patch = (ex: number, si: number, p: Partial<SetEntry>) => setSets((S) => {
    const arr = (S[ex] ?? []).slice(); arr[si] = { ...(arr[si] ?? { done: true }), ...p }; return { ...S, [ex]: arr }
  })
  const addSet = (ex: number) => setSets((S) => {
    const arr = (S[ex] ?? []).slice(); const last = arr[arr.length - 1]; arr.push({ done: true, weight: last?.weight, reps: last?.reps }); return { ...S, [ex]: arr }
  })
  const save = async () => {
    const flat = Object.values(sets).flat()
    const volume = flat.reduce((v, s) => v + (s?.done ? (s.weight || 0) * (s.reps || 0) : 0), 0)
    const setsCompleted = flat.filter((s) => s?.done).length
    if (log.id != null) await db.logs.update(log.id, { sets, volume, setsCompleted })
    if (log.sid) fetch(`/auth/logs/${log.sid}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ sets, volume, setsCompleted }) }).catch(() => {})
    setSaved(true); setTimeout(() => setSaved(false), 1600); onSaved?.(sets)
  }
  const idxs = Object.keys(sets).map(Number).sort((a, b) => a - b)
  return (
    <div className="stack" style={{ gap: 10 }}>
      {idxs.map((ex) => (
        <div key={ex}>
          <div className="section-title" style={{ marginTop: 2 }}>{exNames[ex] || `Exercise ${ex + 1}`}</div>
          <div className="gp2-grid">
            {(sets[ex] || []).map((s, si) => (
              <div key={si} className={'gp2-grow' + (s.done ? ' done' : '')}>
                <span className="gp2-gn">{si + 1}</span>
                <label className="gp2-gf"><input type="number" inputMode="decimal" value={toDisp(s.weight)} placeholder="—" onChange={(e) => patch(ex, si, { weight: e.target.value === '' ? undefined : fromDisp(Number(e.target.value)) })} /><span className="gp2-gu">{unit}</span></label>
                <span className="gp2-gx">×</span>
                <label className="gp2-gf"><input type="number" inputMode="numeric" value={s.reps ?? ''} placeholder="—" onChange={(e) => patch(ex, si, { reps: e.target.value === '' ? undefined : Number(e.target.value) })} /><span className="gp2-gu">reps</span></label>
                <span className="gp2-1rm" style={{ minWidth: 58, textAlign: 'right', margin: 0 }}>{s.weight && s.reps ? `1RM ${toDisp(Math.round(e1rm(s.weight, s.reps)))}` : ''}</span>
              </div>
            ))}
            <button className="gp2-grow gp2-addset" onClick={() => addSet(ex)}>＋ add set</button>
          </div>
        </div>
      ))}
      <button className="btn" style={{ marginTop: 4 }} onClick={save} disabled={saved}>{saved ? 'Saved ✓' : 'Save changes'}</button>
    </div>
  )
}
