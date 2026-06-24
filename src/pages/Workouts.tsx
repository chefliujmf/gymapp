import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { workouts } from '../data/catalog'
import { listTemplates, deleteTemplate } from '../db'
import type { Discipline } from '../types'
import { WorkoutCard } from '../ui'
import { useAuth } from '../auth/AuthContext'

const CAP = 80
const TIMES: [string, (d: number) => boolean][] = [['≤15 min', (d) => d <= 15], ['15–30', (d) => d > 15 && d <= 30], ['30–45', (d) => d > 30 && d <= 45], ['45+', (d) => d > 45]]
const LEVELS = ['beginner', 'intermediate', 'advanced']
const LVL_ORD: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 }
const SORTS: [string, string][] = [['relevance', 'Relevance'], ['shortest', 'Shortest'], ['longest', 'Longest'], ['level', 'Easiest'], ['az', 'A–Z']]

export default function Workouts() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const templates = useLiveQuery(listTemplates) ?? []
  const [filter, setFilter] = useState<Discipline | 'all'>('all')
  const [q, setQ] = useState('')
  const [showF, setShowF] = useState(false)
  const [eqOnly, setEqOnly] = useState(false)
  const [time, setTime] = useState<string | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [sort, setSort] = useState('relevance')

  const owned = useMemo(() => new Set<string>([...(((user?.info as { equipment?: string[] } | undefined)?.equipment) || ['Bodyweight'])]), [user])
  const disciplines = useMemo<(Discipline | 'all')[]>(() => ['all', ...[...new Set(workouts.map((w) => w.discipline))].sort()], [])
  const nFilters = (eqOnly ? 1 : 0) + (time ? 1 : 0) + (level ? 1 : 0)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const timeFn = time ? TIMES.find(([l]) => l === time)?.[1] : null
    let out = workouts.filter((w) =>
      (filter === 'all' || w.discipline === filter) &&
      (!needle || w.title.toLowerCase().includes(needle) || (w.exercises || []).some((e) => e.name.toLowerCase().includes(needle))) &&
      (!eqOnly || (w.equipment || []).every((e) => owned.has(e))) &&
      (!timeFn || timeFn(Number(w.duration) || 0)) &&
      (!level || w.level === level),
    )
    if (sort === 'shortest') out = [...out].sort((a, b) => (a.duration || 0) - (b.duration || 0))
    else if (sort === 'longest') out = [...out].sort((a, b) => (b.duration || 0) - (a.duration || 0))
    else if (sort === 'level') out = [...out].sort((a, b) => (LVL_ORD[a.level] ?? 1) - (LVL_ORD[b.level] ?? 1))
    else if (sort === 'az') out = [...out].sort((a, b) => a.title.localeCompare(b.title))
    return out
  }, [filter, q, eqOnly, time, level, sort, owned])

  return (
    <div>
      <div className="page-head">
        <h1>Train</h1>
        <p>{workouts.length} sessions in your library</p>
      </div>

      <div className="seg">
        <span className="seg__btn seg__btn--active">Workouts</span>
        <Link to="/exercises" className="seg__btn">Exercises</Link>
      </div>

      <input className="search" placeholder="Search workouts…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Link to="/build" className="btn" style={{ marginBottom: 8 }}>＋ Build a workout</Link>

      {templates.length > 0 && (
        <>
          <div className="section-title">My workouts</div>
          <div className="stack" style={{ gap: 8 }}>
            {templates.map((t) => (
              <div key={t.id} className="ex-row">
                <div className="ex-row-text" style={{ flex: 1 }} onClick={() => navigate(`/template/${t.id}/play`)}>
                  <h4>{t.name}</h4>
                  <div className="ex-rx">{t.exercises.length} exercises{t.rounds > 1 ? ` · ${t.rounds} rounds` : ''}</div>
                </div>
                <div className="chips" style={{ margin: 0, gap: 2 }}>
                  <button className="chip" onClick={() => navigate(`/template/${t.id}/play`)}>▶</button>
                  <button className="chip" onClick={() => navigate(`/build?id=${t.id}`)}>✎</button>
                  <button className="chip" style={{ color: 'var(--danger,#c00)' }} onClick={() => t.id && deleteTemplate(t.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Library</div>
      <div className="chips">
        {disciplines.map((f) => (
          <button key={f} className={'chip' + (filter === f ? ' chip--active' : '')} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f}</button>
        ))}
      </div>
      <div className="chips" style={{ marginTop: 6 }}>
        <button className={'chip' + (nFilters ? ' chip--active' : '')} onClick={() => setShowF(true)}>⚙ Filters{nFilters ? ` · ${nFilters}` : ''}</button>
        <button className="chip" onClick={() => setShowF(true)}>↕ {SORTS.find(([v]) => v === sort)?.[1]}</button>
        {eqOnly && <button className="chip chip--active" onClick={() => setEqOnly(false)}>My gear ✕</button>}
        {time && <button className="chip chip--active" onClick={() => setTime(null)}>{time} ✕</button>}
        {level && <button className="chip chip--active" onClick={() => setLevel(null)}>{level} ✕</button>}
      </div>

      <p className="meta" style={{ margin: '8px 2px 10px' }}>
        {list.length} workout{list.length === 1 ? '' : 's'}{list.length > CAP ? ` — showing first ${CAP}` : ''}
      </p>

      <div className="stack">
        {list.slice(0, CAP).map((w) => <WorkoutCard key={w.id} w={w} />)}
        {list.length === 0 && <p className="empty">No workouts match.</p>}
      </div>

      {showF && (
        <div className="sheet-back" onClick={(e) => { if (e.target === e.currentTarget) setShowF(false) }}>
          <div className="sheet">
            <h3 style={{ margin: '0 0 2px' }}>Filters & sort</h3>
            <div className="chips" style={{ marginTop: 10 }}>
              <button className={'chip' + (eqOnly ? ' chip--active' : '')} onClick={() => setEqOnly((v) => !v)}>{eqOnly ? '✓ ' : ''}Only what I own</button>
            </div>
            <div className="section-title" style={{ marginTop: 14 }}>Time</div>
            <div className="chips">{TIMES.map(([l]) => <button key={l} className={'chip' + (time === l ? ' chip--active' : '')} onClick={() => setTime(time === l ? null : l)}>{l}</button>)}</div>
            <div className="section-title" style={{ marginTop: 12 }}>Level</div>
            <div className="chips">{LEVELS.map((l) => <button key={l} className={'chip' + (level === l ? ' chip--active' : '')} onClick={() => setLevel(level === l ? null : l)}>{l}</button>)}</div>
            <div className="section-title" style={{ marginTop: 12 }}>Sort by</div>
            <div className="chips">{SORTS.map(([v, l]) => <button key={v} className={'chip' + (sort === v ? ' chip--active' : '')} onClick={() => setSort(v)}>{l}</button>)}</div>
            <button className="btn" style={{ marginTop: 18 }} onClick={() => setShowF(false)}>Show {list.length} workout{list.length === 1 ? '' : 's'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
