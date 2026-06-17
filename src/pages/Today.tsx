import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { workouts, programs, allWorkoutsById, mealPlan, allRecipesById, mindSessions } from '../data/catalog'
import { WorkoutCard, WeekStrip, disciplineIcon, mindIcon } from '../ui'
import { programProgress } from '../progress'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Today() {
  const navigate = useNavigate()
  const enrollment = useLiveQuery(() => db.enrollments.toArray())
  const todaysLogs = useLiveQuery(() => db.logs.where('date').equals(todayISO()).toArray())
  const session = useLiveQuery(() => db.activeSession.get('current'))
  const activeWorkout = session ? allWorkoutsById[session.workoutId] : undefined

  const allLogs = useLiveQuery(() => db.logs.toArray())
  const active = enrollment?.[0]
  const program = (active ? programs.find((p) => p.id === active.programId) : undefined) ?? programs[0]
  const enrolled = !!active
  const dayIdx = active ? active.currentDayIndex % program.schedule.length : 0
  const todayDay = program.schedule[dayIdx]
  const featured = todayDay?.workoutId ? allWorkoutsById[todayDay.workoutId] : workouts[0]
  const prog = programProgress(program, allLogs)
  const nextDay = program.schedule.find((d) => d.workoutId)

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

      <WeekStrip />

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

      <div className="section-title" style={{ marginTop: 8 }}>Your program</div>
      <Link to={`/programs/${program.id}`} className="card">
        <div className="thumb thumb--wide">{disciplineIcon[program.discipline]}</div>
        <div style={{ padding: '14px 16px 16px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{program.title}</h3>
          <div className="meta">
            {nextDay && <span>Next: <b style={{ color: 'var(--text)' }}>{nextDay.label}</b></span>}
            {!enrolled && <span className="dot">Tap to start</span>}
          </div>
          <div className="progress"><span style={{ width: `${Math.round(prog.pct * 100)}%` }} /></div>
          <div className="meta"><span>{prog.completed}/{prog.total} sessions</span></div>
        </div>
      </Link>

      <div className="section-title">Planner workout</div>
      <Link to={`/workouts/${featured.id}`} className="card">
        <div className="card-row">
          <div className="thumb">{disciplineIcon[featured.discipline]}</div>
          <div className="card-body">
            <span className="eyebrow">{enrolled ? todayDay?.label ?? 'Self-guided' : 'Self-guided'}</span>
            <h3>{featured.title}</h3>
            <div className="meta"><span>{featured.duration} min</span><span className="dot">{featured.level}</span></div>
          </div>
        </div>
      </Link>

      {todaysLogs && todaysLogs.length > 0 && (
        <p style={{ color: 'var(--text-dim)', fontWeight: 700, marginTop: 14 }}>
          ✓ {todaysLogs.length} workout{todaysLogs.length > 1 ? 's' : ''} logged today — nice.
        </p>
      )}

      <div className="section-title">Today's plan</div>
      <div className="stack">
        {(() => {
          const meal = allRecipesById[mealPlan[0].lunch]
          const mind = mindSessions[0]
          return (
            <>
              {meal && (
                <Link to={`/recipes/${meal.id}`} className="card">
                  <div className="card-row">
                    <div className="thumb">🥗</div>
                    <div className="card-body">
                      <span className="eyebrow">Eat</span>
                      <h3>{meal.title}</h3>
                      <div className="meta"><span>{meal.kcal} kcal</span><span className="dot">{meal.protein}g protein</span></div>
                    </div>
                  </div>
                </Link>
              )}
              <Link to={`/mind/${mind.id}`} className="card">
                <div className="card-row">
                  <div className="thumb">{mindIcon[mind.kind]}</div>
                  <div className="card-body">
                    <span className="eyebrow">Mind</span>
                    <h3>{mind.title}</h3>
                    <div className="meta"><span>{mind.duration} min</span><span className="dot">{mind.kind}</span></div>
                  </div>
                </div>
              </Link>
            </>
          )
        })()}
      </div>

      <div className="section-title">
        Quick start
        <Link to="/workouts" className="see-all">All →</Link>
      </div>
      <div className="stack">
        {workouts.slice(0, 4).map((w) => <WorkoutCard key={w.id} w={w} />)}
      </div>
    </div>
  )
}
