import { useMemo, useState } from 'react'
import { endurance } from '../data/catalog'
import type { EnduranceSport } from '../types'
import { EnduranceCard } from '../ui'

const CAP = 80

/** Shared library UI for a single endurance sport (cycling or running). */
export default function EnduranceLib({ sport, title }: { sport: EnduranceSport; title: string }) {
  const [cat, setCat] = useState<string>('all')
  const [q, setQ] = useState('')

  const all = useMemo(() => endurance.filter((e) => e.sport === sport), [sport])
  const categories = useMemo(() => ['all', ...[...new Set(all.map((e) => e.category))].sort()], [all])
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter((e) => (cat === 'all' || e.category === cat) && (!needle || e.name.toLowerCase().includes(needle)))
  }, [all, cat, q])

  return (
    <div>
      <div className="page-head">
        <h1>{title}</h1>
        <p>{all.length} structured {sport} workouts</p>
      </div>

      <input className="search" placeholder={`Search ${sport} workouts…`} value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="chips">
        {categories.map((c) => (
          <button key={c} className={'chip' + (cat === c ? ' chip--active' : '')} onClick={() => setCat(c)}>
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      <p className="meta" style={{ margin: '4px 2px 10px' }}>
        {list.length} workout{list.length === 1 ? '' : 's'}{list.length > CAP ? ` — showing first ${CAP}` : ''}
      </p>

      <div className="stack">
        {list.slice(0, CAP).map((w) => <EnduranceCard key={w.id} w={w} />)}
        {list.length === 0 && <p className="empty">No workouts match.</p>}
      </div>
    </div>
  )
}
