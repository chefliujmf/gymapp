import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWorkoutsById } from '../data/catalog'
import { disciplineIcon } from '../ui'
import {
  db,
  logWorkout,
  startSession,
  saveSession,
  clearSession,
} from '../db'
import { useNow, useWakeLock } from '../hooks'
import type { Exercise } from '../types'

const DEFAULT_REST = 90 // seconds

/** Pull the target set count from a prescription like "4 x 10" -> 4. */
function targetSets(ex: Exercise): number {
  const m = ex.prescription.match(/^\s*(\d+)\s*[x×]/i)
  if (m) return Math.min(parseInt(m[1], 10), 12)
  return 1 // time/interval moves: a single "done" toggle
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
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
  const setsDone = session?.setsDone ?? {}
  const totalTarget = exercises.reduce((s, ex) => s + targetSets(ex), 0)
  const totalDone = exercises.reduce((s, _ex, i) => s + (setsDone[i] ?? 0), 0)
  const restLeft = session?.restEndsAt ? Math.max(0, Math.round((session.restEndsAt - now) / 1000)) : 0

  async function start() {
    await startSession(w!.id)
  }

  async function tapSet(exIndex: number, setIndex: number) {
    const cur = setsDone[exIndex] ?? 0
    // Tapping the next empty dot completes it and starts a rest; tapping an
    // already-filled dot unwinds back to it (mis-tap correction).
    const completing = setIndex >= cur
    const next = completing ? setIndex + 1 : setIndex
    await saveSession({
      setsDone: { ...setsDone, [exIndex]: next },
      restEndsAt: completing ? Date.now() + DEFAULT_REST * 1000 : null,
    })
  }

  async function addRest(sec: number) {
    const base = restLeft > 0 && session?.restEndsAt ? session.restEndsAt : Date.now()
    await saveSession({ restEndsAt: base + sec * 1000 })
  }

  async function skipRest() {
    await saveSession({ restEndsAt: null })
  }

  async function finish() {
    await logWorkout({
      workoutId: w!.id,
      title: w!.title,
      discipline: w!.discipline,
      duration: w!.duration,
      date: new Date().toISOString().slice(0, 10),
    })
    await clearSession()
    navigate('/progress')
  }

  async function quit() {
    await clearSession()
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
        <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>{w.summary}</p>

        <div className="stat-grid">
          <div className="stat"><div className="v">{w.duration}</div><div className="k">min</div></div>
          <div className="stat"><div className="v">{w.calories ?? '—'}</div><div className="k">kcal</div></div>
          <div className="stat"><div className="v" style={{ fontSize: 13 }}>{w.level}</div><div className="k">level</div></div>
          <div className="stat"><div className="v">{isActive ? `${totalDone}/${totalTarget}` : (exercises.length || '—')}</div><div className="k">{isActive ? 'sets' : 'moves'}</div></div>
        </div>

        {!isActive && (
          <div className="video-wrap">
            {w.videoUrl ? (
              <video controls playsInline poster={w.thumbnail} src={w.videoUrl} />
            ) : (
              <div className="video-missing">
                🎬 No video linked yet.<br />Point <code>videoUrl</code> at your Emby stream to play here.
              </div>
            )}
          </div>
        )}

        {/* Rest timer — derived from an absolute end-time, so it's correct the
            instant you reopen after locking the screen. */}
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
          <>
            <div className="section-title">{isActive ? 'Tap a dot as you finish each set' : 'The session'}</div>
            <ul className="plain">
              {exercises.map((ex, i) => {
                const target = targetSets(ex)
                const done = setsDone[i] ?? 0
                return (
                  <li key={i} className="exercise">
                    <div style={{ flex: 1 }}>
                      <h4>{ex.name}</h4>
                      {ex.note && <div className="note">{ex.note}</div>}
                      {isActive && (
                        <div className="dots">
                          {Array.from({ length: target }).map((_, s) => (
                            <button
                              key={s}
                              aria-label={`set ${s + 1}`}
                              className={'dot' + (s < done ? ' dot--on' : '')}
                              onClick={() => tapSet(i, s)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rx">{ex.prescription}</div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <div className="divider" />

        {!isActive ? (
          <button className="btn" onClick={start}>
            {exercises.length ? 'Start workout' : 'Start'}
          </button>
        ) : (
          <>
            <button className="btn" onClick={finish}>Finish &amp; log</button>
            <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={quit}>
              Discard session
            </button>
          </>
        )}
      </div>
    </div>
  )
}
