import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { recipes } from '../data/catalog'
import type { Recipe } from '../types'
import { RecipeCard } from '../ui'

const cats: (Recipe['category'] | 'all')[] = ['all', 'breakfast', 'lunch', 'dinner', 'snack']
const CAP = 80

export default function Recipes() {
  const navigate = useNavigate()
  const [cat, setCat] = useState<Recipe['category'] | 'all'>('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return recipes.filter(
      (r) =>
        (cat === 'all' || r.category === cat) &&
        (!needle ||
          r.title.toLowerCase().includes(needle) ||
          r.tags.some((t) => t.toLowerCase().includes(needle)) ||
          r.ingredients.some((i) => i.toLowerCase().includes(needle))),
    )
  }, [cat, q])

  return (
    <div>
      <button className="back" onClick={() => navigate(-1)} aria-label="Back">‹ Back</button>
      <div className="page-head">
        <h1>Recipes</h1>
        <p>{recipes.length} recipes — fuel that matches your training</p>
      </div>

      <input className="search" placeholder="Search recipes, ingredients, tags…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="chips">
        {cats.map((c) => (
          <button key={c} className={'chip' + (cat === c ? ' chip--active' : '')} onClick={() => setCat(c)}>
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      <p className="meta" style={{ margin: '4px 2px 10px' }}>
        {list.length} recipe{list.length === 1 ? '' : 's'}{list.length > CAP ? ` — showing first ${CAP}` : ''}
      </p>

      <div className="stack">
        {list.slice(0, CAP).map((r) => <RecipeCard key={r.id} r={r} />)}
        {list.length === 0 && <p className="empty">Nothing matches.</p>}
      </div>
    </div>
  )
}
