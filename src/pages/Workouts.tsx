import { useState } from 'react'
import { workouts } from '../data/catalog'
import type { Discipline } from '../types'
import { WorkoutCard } from '../ui'

const filters: (Discipline | 'all')[] = ['all', 'strength', 'yoga', 'pilates', 'mobility', 'hiit']

export default function Workouts() {
  const [filter, setFilter] = useState<Discipline | 'all'>('all')
  const list = filter === 'all' ? workouts : workouts.filter((w) => w.discipline === filter)

  return (
    <div>
      <div className="page-head">
        <h1>Workouts</h1>
        <p>{workouts.length} sessions in your library</p>
      </div>

      <div className="chips">
        {filters.map((f) => (
          <button
            key={f}
            className={'chip' + (filter === f ? ' chip--active' : '')}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      <div className="stack">
        {list.map((w) => <WorkoutCard key={w.id} w={w} />)}
        {list.length === 0 && <p className="empty">No workouts in this category yet.</p>}
      </div>
    </div>
  )
}
