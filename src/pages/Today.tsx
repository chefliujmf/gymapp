import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { workouts, programs, allWorkoutsById } from '../data/catalog'
import { WorkoutCard, disciplineIcon } from '../ui'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Today() {
  const navigate = useNavigate()
  const enrollment = useLiveQuery(() => db.enrollments.toArray())
  const todaysLogs = useLiveQuery(() => db.logs.where('date').equals(todayISO()).toArray())
  const session = useLiveQuery(() => db.activeSession.get('current'))
  const activeWorkout = session ? allWorkoutsById[session.workoutId] : undefined

  const active = enrollment?.[0]
  const program = active ? programs.find((p) => p.id === active.programId) : undefined
  const todayDay = program?.schedule[(active!.currentDayIndex) % program.schedule.length]
  const featured = todayDay?.workoutId ? allWorkoutsById[todayDay.workoutId] : workouts[0]

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{greeting}</span>
        <h1>Ready to train?</h1>
      </div>

      {activeWorkout && (
        <div className="resume" onClick={() => navigate(`/workouts/${activeWorkout.id}`)}>
          <span style={{ fontSize: 24 }}>⏳</span>
          <div className="grow">
            Resume workout
            <small>{activeWorkout.title}</small>
          </div>
          <button className="go">Continue →</button>
        </div>
      )}

      <div className="hero">
        <span className="eyebrow">{program ? `${program.title} · ${todayDay?.label}` : "Today's pick"}</span>
        <h2>{featured.title}</h2>
        <div className="meta">
          <span>{disciplineIcon[featured.discipline]} {featured.discipline}</span>
          <span className="dot">{featured.duration} min</span>
          <span className="dot">{featured.level}</span>
        </div>
        <Link to={`/workouts/${featured.id}`} className="btn">Start workout →</Link>
      </div>

      {todaysLogs && todaysLogs.length > 0 && (
        <p style={{ color: 'var(--accent)', fontWeight: 700, marginTop: 16 }}>
          ✓ {todaysLogs.length} workout{todaysLogs.length > 1 ? 's' : ''} done today — nice.
        </p>
      )}

      {!program && (
        <div className="section-title" style={{ marginTop: 28 }}>
          Jump into a program
          <Link to="/programs" style={{ float: 'right', color: 'var(--text-dim)', fontSize: 14, fontWeight: 600 }}>All →</Link>
        </div>
      )}
      {!program && (
        <Link to={`/programs/${programs[0].id}`} className="btn btn--ghost" style={{ marginBottom: 8 }}>
          📅 {programs[0].title}
        </Link>
      )}

      <div className="section-title">
        Quick start
        <Link to="/workouts" style={{ float: 'right', color: 'var(--text-dim)', fontSize: 14, fontWeight: 600 }}>All →</Link>
      </div>
      <div className="stack">
        {workouts.slice(0, 4).map((w) => <WorkoutCard key={w.id} w={w} />)}
      </div>
    </div>
  )
}
