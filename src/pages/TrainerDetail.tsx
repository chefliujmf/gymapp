import { useNavigate, useParams } from 'react-router-dom'
import { allTrainersById, workouts } from '../data/catalog'
import { WorkoutCard, disciplineIcon } from '../ui'

export default function TrainerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const t = id ? allTrainersById[id] : undefined

  if (!t) return <div className="empty"><div className="big">🤷</div>Trainer not found.</div>

  const theirWorkouts = workouts.filter(
    (w) => w.coach === t.name || t.disciplines.includes(w.discipline),
  )

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          <span style={{ fontSize: 64 }}>{t.name.charAt(0)}</span>
        </div>
      </div>

      <div className="detail-body">
        <span className="eyebrow">{t.specialty}</span>
        <h1>{t.name}</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>{t.bio}</p>

        <div>
          {t.disciplines.map((d) => (
            <span key={d} className="tag">{disciplineIcon[d]} {d}</span>
          ))}
        </div>

        <div className="section-title">Sessions in their style</div>
        <div className="stack">
          {theirWorkouts.map((w) => <WorkoutCard key={w.id} w={w} />)}
          {theirWorkouts.length === 0 && <p className="empty">No sessions yet.</p>}
        </div>
      </div>
    </div>
  )
}
