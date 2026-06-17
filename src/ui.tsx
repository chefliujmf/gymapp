import { Link } from 'react-router-dom'
import type { Discipline, Workout, Program, Recipe, Trainer, MindSession, MindKind } from './types'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Mon–Sun strip for the current week, today highlighted. Centr's signature header. */
export function WeekStrip() {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
  const todayKey = now.toDateString()
  return (
    <div className="week">
      {days.map((d) => (
        <button key={d.toDateString()} className={d.toDateString() === todayKey ? 'on' : ''}>
          {DOW[d.getDay()]}
          <b>{d.getDate()}</b>
        </button>
      ))}
    </div>
  )
}

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

export const mindIcon: Record<MindKind, string> = {
  meditation: '🧘',
  breathwork: '🌬️',
  sleep: '🌙',
  focus: '🎯',
}

export function TrainerCard({ t }: { t: Trainer }) {
  return (
    <Link to={`/trainers/${t.id}`} className="card">
      <div className="card-row">
        <div className="thumb" style={{ borderRadius: 999 }}>{t.name.charAt(0)}</div>
        <div className="card-body">
          <h3>{t.name}</h3>
          <div className="meta">{t.specialty}</div>
        </div>
      </div>
    </Link>
  )
}

export function MindCard({ m }: { m: MindSession }) {
  return (
    <Link to={`/mind/${m.id}`} className="card">
      <div className="card-row">
        <div className="thumb">{mindIcon[m.kind]}</div>
        <div className="card-body">
          <h3>{m.title}</h3>
          <div className="meta">
            <span>{m.duration} min</span>
            <span className="dot">{m.kind}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function Thumb({ src, fallback, className = 'thumb' }: { src?: string; fallback: string; className?: string }) {
  if (src) return <div className={className} style={{ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
  return <div className={className}>{fallback}</div>
}

export function RecipeCard({ r }: { r: Recipe }) {
  return (
    <Link to={`/recipes/${r.id}`} className="card">
      <div className="card-row">
        <Thumb src={r.thumbnail} fallback={categoryIcon[r.category]} />
        <div className="card-body">
          <h3>{r.title}</h3>
          <div className="meta">
            <span>{r.minutes} min</span>
            {r.kcal > 0 && <span className="dot">{r.kcal} kcal</span>}
            {r.protein > 0 && <span className="dot">{r.protein}g protein</span>}
            {r.kcal === 0 && r.diet?.[0] && <span className="dot">{r.diet[0]}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}
