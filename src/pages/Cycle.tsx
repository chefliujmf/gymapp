import { useMemo, useState } from 'react'
import { endurance } from '../data/catalog'
import type { EnduranceSport } from '../types'
import { EnduranceCard } from '../ui'

const CAP = 80

export default function Cycle() {
  const [sport, setSport] = useState<EnduranceSport>('cycling')
  const [cat, setCat] = useState<string>('all')
  const [q, setQ] = useState('')

  const categories = useMemo(() => {
    const set = new Set(endurance.filter((e) => e.sport === sport).map((e) => e.category))
    return ['all', ...[...set].sort()]
  }, [sport])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return endurance.filter(
      (e) =>
        e.sport === sport &&
        (cat === 'all' || e.category === cat) &&
        (!needle || e.name.toLowerCase().includes(needle)),
    )
  }, [sport, cat, q])

  return (
    <div>
      <div className="page-head">
        <h1>Ride</h1>
        <p>{endurance.filter((e) => e.sport === sport).length} structured {sport} workouts</p>
      </div>

      <div className="chips">
        {(['cycling', 'running'] as EnduranceSport[]).map((s) => (
          <button key={s} className={'chip' + (sport === s ? ' chip--active' : '')}
            onClick={() => { setSport(s); setCat('all') }}>
            {s === 'cycling' ? '🚴 Cycling' : '🏃 Running'}
          </button>
        ))}
      </div>

      <input
        className="search"
        placeholder={`Search ${sport} workouts…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="chips">
        {categories.map((c) => (
          <button key={c} className={'chip' + (cat === c ? ' chip--active' : '')} onClick={() => setCat(c)}>
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      <p className="meta" style={{ margin: '4px 2px 10px' }}>
        {list.length} workout{list.length === 1 ? '' : 's'}
        {list.length > CAP ? ` — showing first ${CAP}, refine to see more` : ''}
      </p>

      <div className="stack">
        {list.slice(0, CAP).map((w) => <EnduranceCard key={w.id} w={w} />)}
        {list.length === 0 && <p className="empty">No workouts match.</p>}
      </div>
    </div>
  )
}
