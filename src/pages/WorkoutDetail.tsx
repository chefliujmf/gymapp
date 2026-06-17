import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { allWorkoutsById } from '../data/catalog'
import { disciplineIcon } from '../ui'

function fmtSec(s?: number) {
  if (!s) return ''
  return s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`
}

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const w = id ? allWorkoutsById[id] : undefined
  const [open, setOpen] = useState<number | null>(null)

  if (!w) return <div className="empty"><div className="big">🤷</div>Workout not found.</div>

  const all = w.exercises ?? []
  // The same exercise repeats across rounds — show each unique one once in the preview.
  const seen = new Set<string>()
  const exercises = all.filter((ex) => (seen.has(ex.name) ? false : (seen.add(ex.name), true)))
  const rounds = exercises.length ? Math.round(all.length / exercises.length) : 1

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero" style={w.thumbnail ? { backgroundImage: `url(${w.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          {!w.thumbnail && disciplineIcon[w.discipline]}
        </div>
      </div>

      <div className="detail-body" style={{ paddingBottom: 96 }}>
        <span className="eyebrow">{w.discipline}</span>
        <h1>{w.title}</h1>
        {w.summary && <p className="lead">{w.summary}</p>}

        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <div className="stat"><div className="v">{w.duration}</div><div className="k">min</div></div>
          <div className="stat"><div className="v">{exercises.length}</div><div className="k">exercises</div></div>
        </div>

        <div className="section-title">Exercises{rounds > 1 ? ` · ${rounds} rounds` : ''}</div>
        <ul className="plain stack" style={{ gap: 8 }}>
          {exercises.map((ex, i) => (
            <li key={i}>
              <div className="ex-row" onClick={() => ex.video && setOpen(open === i ? null : i)}>
                <div className="ex-thumb-sm" style={ex.image ? { backgroundImage: `url(${ex.image})` } : undefined}>
                  {ex.video && <span className="ex-play-sm">▶</span>}
                </div>
                <div className="ex-row-text">
                  <h4>{ex.name}</h4>
                  <div className="ex-rx">{fmtSec(ex.seconds) || ex.prescription}{ex.note ? ` · ${ex.note}` : ''}</div>
                </div>
              </div>
              {open === i && ex.video && (
                <video className="ex-video-inline" src={ex.video} poster={ex.image} controls autoPlay loop playsInline muted />
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="start-bar">
        <button className="btn" onClick={() => navigate(`/workouts/${w.id}/play`)}>▶ Start workout</button>
      </div>
    </div>
  )
}
