import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { allProgramsById, allWorkoutsById } from '../data/catalog'
import { disciplineIcon } from '../ui'
import { db, enrollInProgram } from '../db'

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const p = id ? allProgramsById[id] : undefined
  const enrollment = useLiveQuery(
    () => (id ? db.enrollments.where('programId').equals(id).first() : undefined),
    [id],
  )

  if (!p) return <div className="empty"><div className="big">🤷</div>Program not found.</div>

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          {disciplineIcon[p.discipline]}
        </div>
      </div>

      <div className="detail-body">
        <span className="eyebrow">{p.weeks}-week program</span>
        <h1>{p.title}</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>{p.summary}</p>

        <div className="stat-grid">
          <div className="stat"><div className="v">{p.weeks}</div><div className="k">weeks</div></div>
          <div className="stat"><div className="v">{p.daysPerWeek}</div><div className="k">days/wk</div></div>
          <div className="stat"><div className="v" style={{ fontSize: 13 }}>{p.level}</div><div className="k">level</div></div>
          <div className="stat"><div className="v">{p.schedule.length}</div><div className="k">days</div></div>
        </div>

        {enrollment ? (
          <button className="btn" disabled style={{ background: 'var(--bg-elev2)', color: 'var(--accent)' }}>
            ✓ Enrolled
          </button>
        ) : (
          <button className="btn" onClick={() => enrollInProgram(p.id)}>Start this program</button>
        )}

        <div className="section-title">Week structure</div>
        <ul className="plain">
          {p.schedule.map((d) => {
            const w = d.workoutId ? allWorkoutsById[d.workoutId] : null
            const inner = (
              <div className="card-row">
                <div className="thumb" style={{ width: 52, height: 52, fontSize: 22 }}>
                  {w ? disciplineIcon[w.discipline] : '😴'}
                </div>
                <div className="card-body">
                  <h3 style={{ fontSize: 15 }}>Day {d.day} · {d.label}</h3>
                  <div className="meta">{w ? `${w.title} · ${w.duration} min` : 'Rest & recover'}</div>
                </div>
              </div>
            )
            return (
              <li key={d.day} className="card" style={{ marginBottom: 10 }}>
                {w ? <Link to={`/workouts/${w.id}`}>{inner}</Link> : inner}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
