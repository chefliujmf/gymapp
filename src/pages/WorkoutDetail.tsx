import { useNavigate, useParams } from 'react-router-dom'
import { allWorkoutsById } from '../data/catalog'
import { disciplineIcon } from '../ui'
import { logWorkout } from '../db'
import { useState } from 'react'

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const w = id ? allWorkoutsById[id] : undefined
  const [done, setDone] = useState(false)

  if (!w) return <div className="empty"><div className="big">🤷</div>Workout not found.</div>

  async function complete() {
    await logWorkout({
      workoutId: w!.id,
      title: w!.title,
      discipline: w!.discipline,
      duration: w!.duration,
      date: new Date().toISOString().slice(0, 10),
    })
    setDone(true)
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
        <span className="eyebrow">{w.discipline}</span>
        <h1>{w.title}</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>{w.summary}</p>

        <div className="stat-grid">
          <div className="stat"><div className="v">{w.duration}</div><div className="k">min</div></div>
          <div className="stat"><div className="v">{w.calories ?? '—'}</div><div className="k">kcal</div></div>
          <div className="stat"><div className="v" style={{ fontSize: 13 }}>{w.level}</div><div className="k">level</div></div>
          <div className="stat"><div className="v">{w.exercises?.length ?? '—'}</div><div className="k">moves</div></div>
        </div>

        <div className="video-wrap">
          {w.videoUrl ? (
            <video controls playsInline poster={w.thumbnail} src={w.videoUrl} />
          ) : (
            <div className="video-missing">
              🎬 No video linked yet.<br />Point <code>videoUrl</code> at your Emby stream to play here.
            </div>
          )}
        </div>

        {w.equipment.length > 0 && (
          <p className="meta">Equipment: {w.equipment.join(', ')}</p>
        )}

        {w.exercises && (
          <>
            <div className="section-title">The session</div>
            <ul className="plain">
              {w.exercises.map((ex, i) => (
                <li key={i} className="exercise">
                  <div>
                    <h4>{ex.name}</h4>
                    {ex.note && <div className="note">{ex.note}</div>}
                  </div>
                  <div className="rx">{ex.prescription}</div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="divider" />
        {done ? (
          <button className="btn" disabled style={{ background: 'var(--bg-elev2)', color: 'var(--accent)' }}>
            ✓ Logged — great work
          </button>
        ) : (
          <button className="btn" onClick={complete}>Mark complete</button>
        )}
      </div>
    </div>
  )
}
