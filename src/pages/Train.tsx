import { Link, useNavigate } from 'react-router-dom'
import { workouts, trainers } from '../data/catalog'
import { WorkoutCard, TrainerCard } from '../ui'

export default function Train() {
  const navigate = useNavigate()
  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head">
        <h1>Gym</h1>
        <p>Workouts and your trainers</p>
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

      <div className="section-title">
        Trainers
        <Link to="/trainers" className="see-all">All →</Link>
      </div>
      <div className="stack">
        {trainers.map((t) => <TrainerCard key={t.id} t={t} />)}
      </div>
    </div>
  )
}
