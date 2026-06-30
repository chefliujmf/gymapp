import { Link, useNavigate } from 'react-router-dom'
import { workouts } from '../data/catalog'
import { WorkoutCard } from '../ui'

export default function Train() {
  const navigate = useNavigate()
  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head">
        <h1>Gym</h1>
        <p>Workouts &amp; exercises</p>
      </div>

      {/* #118: surface the gym builder here (parity with Ride/Run "+ Build") */}
      <Link to="/build" className="btn" style={{ marginBottom: 12 }}>＋ Build a gym workout</Link>

      <div className="section-title">
        Workouts
        <Link to="/workouts" className="see-all">All {workouts.length} →</Link>
      </div>
      <div className="stack">
        {workouts.slice(0, 4).map((w) => <WorkoutCard key={w.id} w={w} />)}
      </div>

      {/* #242: quick access to the exercise library */}
      <div className="section-title">Exercises<Link to="/exercises" className="see-all">Browse →</Link></div>
      <Link to="/exercises" className="card hub-link">
        <span className="hub-link__ic">🏋️</span>
        <span className="hub-link__t"><h3>Exercise library</h3><div className="meta">Browse & filter every exercise (by equipment, muscle…)</div></span>
        <span className="hub-link__ch">›</span>
      </Link>
    </div>
  )
}
