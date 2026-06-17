import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWorkoutsById } from '../data/catalog'
import { disciplineIcon } from '../ui'
import { db, logWorkout, startSession, saveSession, clearSession, type SetEntry } from '../db'
import { useNow, useWakeLock } from '../hooks'
import type { Exercise } from '../types'

const DEFAULT_REST = 90 // seconds

/** Target set count from a prescription like "4 x 6-8" -> 4 (fallback 3). */
function targetSets(ex: Exercise): number {
  const m = ex.prescription.match(/^\s*(\d+)\s*[x×]/i)
  if (m) return Math.min(parseInt(m[1], 10), 12)
  return 3
}
/** Suggested reps from "4 x 6-8" -> 8 (top of range), for prefilling. */
function targetReps(ex: Exercise): number | undefined {
  const m = ex.prescription.match(/[x×]\s*(\d+)(?:\s*-\s*(\d+))?/i)
  if (m) return parseInt(m[2] || m[1], 10)
  return undefined
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const w = id ? allWorkoutsById[id] : undefined

  const session = useLiveQuery(() => db.activeSession.get('current'), [])
  const now = useNow()
  const isActive = session?.workoutId === id
  useWakeLock(isActive)

  if (!w) return <div className="empty"><div className="big">🤷</div>Workout not found.</div>

  const exercises = w.exercises ?? []
  const sets = session?.sets ?? {}
  const restLeft = session?.restEndsAt ? Math.max(0, Math.round((session.restEndsAt - now) / 1000)) : 0

  const doneCount = Object.values(sets).flat().filter((s) => s.done).length
  const totalCount = Object.values(sets).flat().length
  const volume = Object.values(sets).flat().reduce((v, s) => v + (s.done ? (s.weight ?? 0) * (s.reps ?? 0) : 0), 0)

  async function start() {
    const init: Record<number, SetEntry[]> = {}
    exercises.forEach((ex, i) => {
      const reps = targetReps(ex)
      init[i] = Array.from({ length: targetSets(ex) }, () => ({ done: false, reps }))
    })
    await startSession(w!.id, init)
  }

  async function updateSet(exIdx: number, setIdx: number, patch: Partial<SetEntry>) {
    if (!session) return
    const next = { ...sets, [exIdx]: sets[exIdx].map((s, i) => (i === setIdx ? { ...s, ...patch } : s)) }
    const completing = patch.done === true && !sets[exIdx][setIdx].done
    await saveSession({ sets: next, restEndsAt: completing ? Date.now() + DEFAULT_REST * 1000 : session.restEndsAt ?? null })
  }

  async function addSet(exIdx: number) {
    if (!session) return
    const last = sets[exIdx][sets[exIdx].length - 1]
    await saveSession({ sets: { ...sets, [exIdx]: [...sets[exIdx], { done: false, weight: last?.weight, reps: last?.reps }] } })
  }

  async function addRest(sec: number) {
    const base = restLeft > 0 && session?.restEndsAt ? session.restEndsAt : Date.now()
    await saveSession({ restEndsAt: base + sec * 1000 })
  }
  async function skipRest() { await saveSession({ restEndsAt: null }) }

  async function finish() {
    await logWorkout({
      workoutId: w!.id,
      title: w!.title,
      discipline: w!.discipline,
      duration: w!.duration,
      date: new Date().toISOString().slice(0, 10),
      setsCompleted: doneCount,
      volume: Math.round(volume),
    })
    await clearSession()
    navigate('/progress')
  }

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          {disciplineIcon[w.discipline]}
        </div>
      </div>

      <div className="detail-body">
        <span className="eyebrow">{w.discipline}{isActive ? ' · in progress' : ''}</span>
        <h1>{w.title}</h1>
        <p className="lead">{w.summary}</p>

        <div className="stat-grid">
          <div className="stat"><div className="v">{w.duration}</div><div className="k">min</div></div>
          <div className="stat"><div className="v">{exercises.length}</div><div className="k">exercises</div></div>
          <div className="stat"><div className="v">{isActive ? `${doneCount}/${totalCount}` : (w.calories ?? '—')}</div><div className="k">{isActive ? 'sets' : 'kcal'}</div></div>
          <div className="stat"><div className="v" style={{ fontSize: 13 }}>{isActive ? `${Math.round(volume)}` : w.level}</div><div className="k">{isActive ? 'volume' : 'level'}</div></div>
        </div>

        {!isActive && (
          <div className="video-wrap">
            {w.videoUrl ? (
              <video controls playsInline poster={w.thumbnail} src={w.videoUrl} />
            ) : (
              <div className="video-missing">No video linked — point <code>videoUrl</code> at your Emby stream.</div>
            )}
          </div>
        )}

        {isActive && session?.restEndsAt && restLeft > 0 && (
          <div className="rest">
            <div className="rest__time">{fmt(restLeft)}</div>
            <div className="rest__label">Rest — next set when ready</div>
            <div className="rest__row">
              <button className="chip" onClick={() => addRest(30)}>+30s</button>
              <button className="chip" onClick={skipRest}>Skip ▶</button>
            </div>
          </div>
        )}

        {exercises.length > 0 && (
          <ul className="plain" style={{ marginTop: 18 }}>
            {exercises.map((ex, i) => (
              <li key={i} className="ex-block">
                <div className="ex-head">
                  <div>
                    <h4>
                      {ex.name}
                      {ex.demoUrl && <a className="demo-link" href={ex.demoUrl} target="_blank" rel="noreferrer">demo ↗</a>}
                    </h4>
                    <div className="ex-rx">{ex.prescription}{ex.note ? ` · ${ex.note}` : ''}</div>
                  </div>
                </div>

                {isActive && sets[i] && (
                  <div className="set-table">
                    <div className="set-row set-row--head">
                      <span>Set</span><span>kg</span><span>Reps</span><span>✓</span>
                    </div>
                    {sets[i].map((s, si) => (
                      <div key={si} className={'set-row' + (s.done ? ' set-row--done' : '')}>
                        <span className="set-no">{si + 1}</span>
                        <input
                          className="set-input" type="number" inputMode="decimal" placeholder="—"
                          value={s.weight ?? ''}
                          onChange={(e) => updateSet(i, si, { weight: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                        <input
                          className="set-input" type="number" inputMode="numeric" placeholder="—"
                          value={s.reps ?? ''}
                          onChange={(e) => updateSet(i, si, { reps: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                        <button className={'set-check' + (s.done ? ' set-check--on' : '')} onClick={() => updateSet(i, si, { done: !s.done })}>
                          {s.done ? '✓' : ''}
                        </button>
                      </div>
                    ))}
                    <button className="add-set" onClick={() => addSet(i)}>+ Add set</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="divider" />

        {!isActive ? (
          <button className="btn" onClick={start}>Start workout</button>
        ) : (
          <>
            <button className="btn" onClick={finish}>Finish &amp; log</button>
            <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={() => clearSession()}>Discard session</button>
          </>
        )}
      </div>
    </div>
  )
}
