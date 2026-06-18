import { Link } from 'react-router-dom'
import type { Discipline, Workout, Program, Recipe, Trainer, MindSession, MindKind, EnduranceWorkout } from './types'
import { localISO } from './date'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Mon–Sun strip for the current week, today highlighted. week header. */
export function WeekStrip({ selected, onSelect }: { selected?: string; onSelect?: (iso: string) => void } = {}) {
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
      {days.map((d) => {
        const iso = localISO(d)
        const on = selected ? iso === selected : d.toDateString() === todayKey
        return (
          <button key={iso} className={on ? 'on' : ''} onClick={() => onSelect?.(iso)}>
            {DOW[d.getDay()]}
            <b>{d.getDate()}</b>
          </button>
        )
      })}
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

// --- Endurance (cycling / running) ----------------------------------------

/** Power-zone colour for a % of FTP/threshold — mirrors JOIN's profile graph. */
export function zoneColor(pct: number): string {
  if (pct < 60) return '#7fd1ff'   // recovery
  if (pct < 76) return '#43d9a3'   // endurance
  if (pct < 91) return '#ffd23f'   // tempo
  if (pct < 106) return '#ff9f43'  // threshold
  if (pct < 121) return '#ff6b6b'  // vo2max
  return '#e63946'                 // anaerobic
}

/** Flatten blocks (expanding numRepeats) into a single list of intervals. */
export function flattenIntervals(w: EnduranceWorkout) {
  const out: { duration: number; rawPower: number; power?: string; heartRate?: string }[] = []
  for (const b of w.blocks) {
    for (let r = 0; r < (b.numRepeats || 1); r++) {
      for (const iv of b.intervals) out.push(iv)
    }
  }
  return out
}

/** Training Stress Score, computed from the structured intervals.
 *  TSS = Σ(duration_s · IF²) / 3600 · 100, with IF = %FTP / 100 per segment.
 *  (JOIN's `stress` field is a 1–5 difficulty rating, not TSS.) */
export function computeTSS(w: EnduranceWorkout): number {
  let weighted = 0
  for (const iv of flattenIntervals(w)) {
    const intensityFactor = (iv.rawPower || 0) / 100
    weighted += (iv.duration || 0) * intensityFactor * intensityFactor
  }
  return Math.round((weighted / 3600) * 100)
}

/** join.cc-style interval profile rendered from the structured data. */
export function IntervalProfile({ w, height = 110 }: { w: EnduranceWorkout; height?: number }) {
  const ivs = flattenIntervals(w)
  const total = ivs.reduce((s, i) => s + (i.duration || 0), 0) || 1
  const maxP = Math.max(120, ...ivs.map((i) => i.rawPower || 0))
  const ftpY = (100 / maxP) * 100
  return (
    <div className="profile" style={{ height, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 1, width: '100%' }}>
      {/* FTP (100%) reference line */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${ftpY}%`, borderTop: '1px dashed rgba(255,255,255,.22)', pointerEvents: 'none' }} />
      <span style={{ position: 'absolute', right: 2, bottom: `calc(${ftpY}% + 2px)`, fontSize: 9, color: 'rgba(255,255,255,.45)' }}>FTP</span>
      {ivs.map((iv, idx) => {
        const showVal = idx === 0 || ivs[idx - 1].rawPower !== iv.rawPower
        return (
          <div key={idx} title={`${Math.round(iv.duration)}s @ ${iv.rawPower}%${iv.power ? ` (${iv.power}W)` : ''}`}
            style={{ position: 'relative', flexGrow: iv.duration / total, flexBasis: 0, height: `${Math.max(6, ((iv.rawPower || 0) / maxP) * 100)}%`, background: zoneColor(iv.rawPower || 0), borderRadius: '2px 2px 0 0' }}>
            {showVal && <span className="profile-lbl">{iv.rawPower}%</span>}
          </div>
        )
      })}
    </div>
  )
}

export const sportIcon: Record<string, string> = { cycling: '🚴', running: '🏃' }

export function EnduranceCard({ w }: { w: EnduranceWorkout }) {
  return (
    <Link to={`/cycle/${w.id}`} className="card">
      <div className="card-row" style={{ alignItems: 'stretch' }}>
        <div className="card-body">
          <h3>{w.name}</h3>
          <div className="meta">
            <span>{sportIcon[w.sport]} {w.duration} min</span>
            <span className="dot">{w.category}</span>
            <span className="dot">{computeTSS(w)} TSS</span>
          </div>
          <div style={{ marginTop: 10 }}><IntervalProfile w={w} height={44} /></div>
        </div>
      </div>
    </Link>
  )
}
