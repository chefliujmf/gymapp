import { Link } from 'react-router-dom'
import type { Discipline, Workout, Program, Recipe } from './types'

export const disciplineIcon: Record<Discipline, string> = {
  strength: '🏋️',
  hiit: '🔥',
  cardio: '🚴',
  yoga: '🧘',
  pilates: '🤸',
  mobility: '🌀',
  boxing: '🥊',
  meditation: '🌙',
}

const categoryIcon: Record<Recipe['category'], string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🥤',
}

export function WorkoutCard({ w }: { w: Workout }) {
  return (
    <Link to={`/workouts/${w.id}`} className="card">
      <div className="card-row">
        <div className="thumb">{disciplineIcon[w.discipline]}</div>
        <div className="card-body">
          <h3>{w.title}</h3>
          <div className="meta">
            <span>{w.duration} min</span>
            <span className="dot">{w.discipline}</span>
            <span className="dot">{w.level}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ProgramCard({ p }: { p: Program }) {
  return (
    <Link to={`/programs/${p.id}`} className="card">
      <div className="thumb thumb--wide">{disciplineIcon[p.discipline]}</div>
      <div className="card-row" style={{ paddingTop: 12 }}>
        <div className="card-body">
          <h3>{p.title}</h3>
          <div className="meta">
            <span>{p.weeks} weeks</span>
            <span className="dot">{p.daysPerWeek}×/week</span>
            <span className="dot">{p.level}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function RecipeCard({ r }: { r: Recipe }) {
  return (
    <Link to={`/recipes/${r.id}`} className="card">
      <div className="card-row">
        <div className="thumb">{categoryIcon[r.category]}</div>
        <div className="card-body">
          <h3>{r.title}</h3>
          <div className="meta">
            <span>{r.minutes} min</span>
            <span className="dot">{r.kcal} kcal</span>
            <span className="dot">{r.protein}g protein</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
