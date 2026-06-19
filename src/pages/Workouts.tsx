import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { workouts } from '../data/catalog'
import { listTemplates, deleteTemplate } from '../db'
import type { Discipline } from '../types'
import { WorkoutCard } from '../ui'

const CAP = 80

export default function Workouts() {
  const navigate = useNavigate()
  const templates = useLiveQuery(listTemplates) ?? []
  const [filter, setFilter] = useState<Discipline | 'all'>('all')
  const [q, setQ] = useState('')

  const filters = useMemo<(Discipline | 'all')[]>(
    () => ['all', ...[...new Set(workouts.map((w) => w.discipline))].sort()],
    [],
  )
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return workouts.filter(
      (w) =>
        (filter === 'all' || w.discipline === filter) &&
        (!needle ||
          w.title.toLowerCase().includes(needle) ||
          (w.exercises || []).some((e) => e.name.toLowerCase().includes(needle))),
    )
  }, [filter, q])

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
        {filters.map((f) => (
          <button key={f} className={'chip' + (filter === f ? ' chip--active' : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      <p className="meta" style={{ margin: '4px 2px 10px' }}>
        {list.length} workout{list.length === 1 ? '' : 's'}{list.length > CAP ? ` — showing first ${CAP}` : ''}
      </p>

      <div className="stack">
        {list.slice(0, CAP).map((w) => <WorkoutCard key={w.id} w={w} />)}
        {list.length === 0 && <p className="empty">No workouts match.</p>}
      </div>
    </div>
  )
}
