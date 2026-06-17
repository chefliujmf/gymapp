import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { allProgramsById, allWorkoutsById } from '../data/catalog'
import { disciplineIcon } from '../ui'
import { db, enrollInProgram } from '../db'
import { programProgress } from '../progress'

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const p = id ? allProgramsById[id] : undefined
  const enrollment = useLiveQuery(
    () => (id ? db.enrollments.where('programId').equals(id).first() : undefined),
    [id],
  )
  const logs = useLiveQuery(() => db.logs.toArray())

  if (!p) return <div className="empty"><div className="big">🤷</div>Program not found.</div>

  const prog = programProgress(p, logs)
  const trainingDays = p.schedule.filter((d) => d.workoutId)
  const upNext = trainingDays.length ? trainingDays[prog.completed % trainingDays.length] : undefined
  const upNextWorkout = upNext?.workoutId ? allWorkoutsById[upNext.workoutId] : undefined
  // numbered circles, capped so very long programs stay tidy
  const circles = Math.min(prog.total, 42)

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          {disciplineIcon[p.discipline]}
        </div>
      </div>

      <div className="detail-body">
        <span className="eyebrow">Program</span>
        <h1 style={{ textTransform: 'uppercase' }}>{p.title}</h1>
        <p className="lead">{p.summary}</p>

        {/* progress */}
        <div className="section-title" style={{ marginBottom: 6 }}>
          Progress<span className="see-all">{prog.completed}/{prog.total}</span>
        </div>
        <div className="progress"><span style={{ width: `${Math.round(prog.pct * 100)}%` }} /></div>

        {/* up next */}
        {upNextWorkout && (
          <>
            <div className="section-title">Up next</div>
            <Link to={`/workouts/${upNextWorkout.id}`} className="card">
              <div className="card-row">
                <div className="thumb">{disciplineIcon[upNextWorkout.discipline]}</div>
                <div className="card-body">
                  <span className="eyebrow">{upNext?.label}</span>
                  <h3>{upNextWorkout.title}</h3>
                  <div className="meta"><span>{upNextWorkout.duration} min</span><span className="dot">{upNextWorkout.level}</span></div>
                </div>
              </div>
            </Link>
          </>
        )}

        {enrollment ? (
          <button className="btn btn--ghost" disabled style={{ marginTop: 16 }}>✓ Enrolled</button>
        ) : (
          <button className="btn" style={{ marginTop: 16 }} onClick={() => enrollInProgram(p.id)}>Start this program</button>
        )}

        {/* numbered day circles */}
        <div className="section-title">Sessions</div>
        <div className="circles">
          {Array.from({ length: circles }, (_, i) => (
            <span key={i} className={'circle' + (i < prog.completed ? ' circle--done' : i === prog.completed ? ' circle--now' : '')}>
              {i + 1}
            </span>
          ))}
        </div>

        <div className="section-title">Week structure</div>
        <ul className="plain stack">
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
              <li key={d.day} className="card">
                {w ? <Link to={`/workouts/${w.id}`}>{inner}</Link> : inner}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
