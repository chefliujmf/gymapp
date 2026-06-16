import { useState } from 'react'
import { recipes } from '../data/catalog'
import type { Recipe } from '../types'
import { RecipeCard } from '../ui'

const cats: (Recipe['category'] | 'all')[] = ['all', 'breakfast', 'lunch', 'dinner', 'snack']

export default function Recipes() {
  const [cat, setCat] = useState<Recipe['category'] | 'all'>('all')
  const list = cat === 'all' ? recipes : recipes.filter((r) => r.category === cat)

  return (
    <div>
      <div className="page-head">
        <h1>Recipes</h1>
        <p>Fuel that matches your training</p>
      </div>

      <div className="chips">
        {cats.map((c) => (
          <button key={c} className={'chip' + (cat === c ? ' chip--active' : '')} onClick={() => setCat(c)}>
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      <div className="stack">
        {list.map((r) => <RecipeCard key={r.id} r={r} />)}
        {list.length === 0 && <p className="empty">Nothing here yet.</p>}
      </div>
    </div>
  )
}
