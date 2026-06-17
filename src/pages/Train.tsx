import { Link } from 'react-router-dom'
import { workouts, programs, trainers } from '../data/catalog'
import { WorkoutCard, ProgramCard, TrainerCard } from '../ui'

export default function Train() {
  return (
    <div>
      <div className="page-head">
        <h1>Train</h1>
        <p>Programs, workouts and your trainers</p>
      </div>

      <div className="section-title">
        Programs
        <Link to="/programs" className="see-all">All →</Link>
      </div>
      <div className="stack">
        {programs.slice(0, 2).map((p) => <ProgramCard key={p.id} p={p} />)}
      </div>

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
