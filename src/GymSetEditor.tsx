import { useState } from 'react'
import { db, getSetting, logWorkout, type WorkoutLog, type SetEntry } from './db'
import { useLiveQuery } from 'dexie-react-hooks'
import { e1rm } from './strength'

// #591 — POST-WORKOUT edit: fix a completed gym session's sets (mistyped weight/rep) from the result page,
// reusing the in-workout JeFit grid look. Recomputes volume/setsCompleted and saves both locally (Dexie) and
// to the server (PUT /auth/logs/:sid) — the SAME persistence History uses (Logs.tsx), so it's the one source of
// truth. onSaved hands the new sets back so the parent's summary (volume/1RM/PRs) recomputes live.
// #727/#730 — extended into the "Log what you did" sheet on the COMPLETED view: seed rows from the plan's targets
// (so a device-recorded gym with NO logged weights still lists every exercise to fill in), render the field that
// FITS each exercise's MODE (weight×reps loaded, reps only, or a timed hold — JM: "not just weight if it's rep or
// time"), and CREATE the log if none exists yet (device gym). Backward-compatible: with no `seed`/`create` props it
// behaves exactly as the #591 editor (edit an existing log's sets).
const LB = 2.2046226
type Target = { mode?: 'timed' | 'reps'; seconds?: number; sets?: number; reps?: number; weight?: number; eachSide?: boolean }
export default function GymSetEditor({ log, exNames, seed, showAll = false, create, onSaved, onCancel }: {
  log: WorkoutLog
  exNames: string[]
  seed?: Target[]                 // #727 — per-exercise plan targets (index-aligned with exNames): seed empty rows + drive timed rendering
  showAll?: boolean               // #727 — list EVERY exercise (seed the ones with no logged sets), not just those already logged
  create?: { workoutId: string; title: string; discipline: string; date: string; duration: number } // #727 — create the log on save if it doesn't exist yet
  onSaved?: (sets: Record<number, SetEntry[]>) => void
  onCancel?: () => void
}) {
  const imp = (useLiveQuery(() => getSetting('units')) as string | undefined) === 'imperial'
  const unit = imp ? 'lb' : 'kg'
  const toDisp = (kg?: number) => kg == null ? '' : String(imp ? Math.round(kg * LB * 10) / 10 : kg)
  const fromDisp = (v: number) => imp ? v / LB : v
  const isTimed = (ex: number) => (seed?.[ex]?.mode || 'reps') === 'timed'
  // #727 — seconds<->mm:ss for the timed input
  const toClock = (sec?: number) => sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  const fromClock = (v: string) => { const m = v.match(/^(\d+):(\d{1,2})$/); if (m) return Number(m[1]) * 60 + Number(m[2]); const n = Number(v); return isNaN(n) ? undefined : (v.includes(':') ? undefined : n) }
  // #727 — build the initial set map: keep any logged sets; for a showAll sheet, seed missing exercises from the plan targets.
  const initial = (): Record<number, SetEntry[]> => {
    const S: Record<number, SetEntry[]> = JSON.parse(JSON.stringify(log.sets || {}))
    if (showAll) {
      for (let ex = 0; ex < exNames.length; ex++) {
        if (S[ex] && S[ex].length) continue
        const t = seed?.[ex] || {}
        const n = Math.max(1, Number(t.sets) || 1)
        const row: SetEntry = (t.mode === 'timed')
          ? { done: true, seconds: Number(t.seconds) > 0 ? Number(t.seconds) : 40 }
          : { done: true, reps: Number(t.reps) || undefined, weight: Number(t.weight) || undefined }
        S[ex] = Array.from({ length: n }, () => ({ ...row }))
      }
    }
    return S
  }
  const [sets, setSets] = useState<Record<number, SetEntry[]>>(initial)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const patch = (ex: number, si: number, p: Partial<SetEntry>) => setSets((S) => {
    const arr = (S[ex] ?? []).slice(); arr[si] = { ...(arr[si] ?? { done: true }), ...p }; return { ...S, [ex]: arr }
  })
  const addSet = (ex: number) => setSets((S) => {
    const arr = (S[ex] ?? []).slice(); const last = arr[arr.length - 1]
    arr.push(isTimed(ex) ? { done: true, seconds: last?.seconds } : { done: true, weight: last?.weight, reps: last?.reps })
    return { ...S, [ex]: arr }
  })
  const save = async () => {
    setBusy(true)
    const flat = Object.values(sets).flat()
    const volume = flat.reduce((v, s) => v + (s?.done && !s?.warmup ? (s.weight || 0) * (s.reps || 0) : 0), 0)
    const setsCompleted = flat.filter((s) => s?.done).length
    try {
      if (log.id != null || log.sid) {
        if (log.id != null) await db.logs.update(log.id, { sets, volume, setsCompleted, exNames })
        if (log.sid) await fetch(`/auth/logs/${log.sid}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ sets, volume, setsCompleted, exNames }) }).catch(() => {})
      } else if (create) {
        // #727 — first time logging a device-recorded gym: CREATE the log (mirrors to the account like the player does).
        await logWorkout({ workoutId: create.workoutId, title: create.title, discipline: create.discipline, duration: create.duration, date: create.date, sets, setsCompleted, volume, exNames, exIds: exNames.map(() => undefined) })
      }
      setSaved(true); setTimeout(() => setSaved(false), 1600); onSaved?.(sets)
    } finally { setBusy(false) }
  }
  // #678 — did anything actually change vs the loaded state? (so Cancel can warn-free discard + the Save gate is honest)
  const base0 = showAll ? initial() : (log.sets || {})
  const dirty = JSON.stringify(sets) !== JSON.stringify(base0)
  const idxs = showAll ? exNames.map((_, i) => i) : Object.keys(sets).map(Number).sort((a, b) => a - b)
  return (
    <div className="stack" style={{ gap: 10 }}>
      {idxs.map((ex) => {
        const timed = isTimed(ex)
        const t = seed?.[ex]
        const target = t ? (timed ? `${t.sets || 1} × ${t.seconds || 40}s hold` : `planned ${t.sets || 3}×${t.reps || 10}${t.eachSide ? ' each side' : ''}`) : ''
        return (
          <div key={ex}>
            <div className="section-title" style={{ marginTop: 2 }}>{exNames[ex] || `Exercise ${ex + 1}`}{target ? <span className="meta" style={{ fontWeight: 400 }}> · {target}</span> : null}</div>
            <div className="gp2-grid">
              {(sets[ex] || []).map((s, si) => (
                <div key={si} className={'gp2-grow' + (s.done ? ' done' : '') + (s.warmup ? ' warm' : '')}>
                  <button type="button" className={'gp2-gn' + (s.warmup ? ' gp2-gn--w' : '')} onClick={() => patch(ex, si, { warmup: !s.warmup })} title={s.warmup ? 'Warm-up set — tap to make it a working set' : 'Tap to mark a warm-up set'}>{s.warmup ? 'W' : si + 1}</button>
                  {timed ? (
                    <label className="gp2-gf" style={{ flex: 1 }}><input type="text" inputMode="numeric" value={toClock(s.seconds)} placeholder="0:40" onChange={(e) => patch(ex, si, { seconds: fromClock(e.target.value) })} /><span className="gp2-gu">min:sec</span></label>
                  ) : (
                    <>
                      <label className="gp2-gf"><input type="number" inputMode="decimal" value={toDisp(s.weight)} placeholder="—" onChange={(e) => patch(ex, si, { weight: e.target.value === '' ? undefined : fromDisp(Number(e.target.value)) })} /><span className="gp2-gu">{unit}</span></label>
                      <span className="gp2-gx">×</span>
                      <label className="gp2-gf"><input type="number" inputMode="numeric" value={s.reps ?? ''} placeholder="—" onChange={(e) => patch(ex, si, { reps: e.target.value === '' ? undefined : Number(e.target.value) })} /><span className="gp2-gu">{t?.eachSide ? 'reps/side' : 'reps'}</span></label>
                      <span className="gp2-1rm" style={{ minWidth: 58, textAlign: 'right', margin: 0 }}>{s.weight && s.reps ? `1RM ${toDisp(Math.round(e1rm(s.weight, s.reps)))}` : ''}</span>
                    </>
                  )}
                </div>
              ))}
              <button className="gp2-grow gp2-addset" onClick={() => addSet(ex)}>＋ add set</button>
            </div>
          </div>
        )
      })}
      {/* #678 — an explicit Cancel that DISCARDS edits + closes; Save stays disabled until something actually changes. */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {/* width:auto overrides .btn's width:100% so flex sizing wins (else Cancel eats the row + Save is a sliver). */}
        {onCancel && <button className="btn btn--ghost" style={{ flex: '0 0 auto', width: 'auto', padding: '0 18px' }} onClick={() => { setSets(initial()); onCancel() }}>Cancel</button>}
        <button className="btn" style={{ flex: 1, width: 'auto', minWidth: 0 }} onClick={save} disabled={saved || busy || (!dirty && !create)}>{saved ? 'Saved ✓' : busy ? 'Saving…' : (create && !(log.id != null || log.sid)) ? 'Save what I lifted' : 'Save changes'}</button>
      </div>
    </div>
  )
}
