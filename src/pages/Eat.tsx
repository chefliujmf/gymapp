import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mealPlan, allRecipesById, recipes } from '../data/catalog'

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const slots: Slot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const slotIcon: Record<Slot, string> = { breakfast: '🍳', lunch: '🥗', dinner: '🍽️', snack: '🥤' }

function buildShoppingList(): string[] {
  // Aggregate unique ingredient lines across the whole plan's recipes.
  const ids = new Set<string>()
  for (const d of mealPlan) slots.forEach((s) => ids.add(d[s]))
  const lines = new Set<string>()
  for (const id of ids) allRecipesById[id]?.ingredients.forEach((i) => lines.add(i))
  return [...lines].sort()
}

export default function Eat() {
  const [day, setDay] = useState(1)
  const [tab, setTab] = useState<'plan' | 'shop'>('plan')
  const today = mealPlan.find((d) => d.day === day) ?? mealPlan[0]
  const shopping = buildShoppingList()

  const dayKcal = slots.reduce((s, slot) => s + (allRecipesById[today[slot]]?.kcal ?? 0), 0)
  const dayProtein = slots.reduce((s, slot) => s + (allRecipesById[today[slot]]?.protein ?? 0), 0)

  return (
    <div>
      <div className="page-head">
        <h1>Eat</h1>
        <p>Your meal plan, recipes and shopping list</p>
      </div>

      <div className="chips">
        <button className={'chip' + (tab === 'plan' ? ' chip--active' : '')} onClick={() => setTab('plan')}>Meal plan</button>
        <button className={'chip' + (tab === 'shop' ? ' chip--active' : '')} onClick={() => setTab('shop')}>Shopping list</button>
        <Link to="/recipes" className="chip">All recipes →</Link>
      </div>

      {tab === 'plan' ? (
        <>
          <div className="chips">
            {mealPlan.map((d) => (
              <button key={d.day} className={'chip' + (day === d.day ? ' chip--active' : '')} onClick={() => setDay(d.day)}>
                Day {d.day}
              </button>
            ))}
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <div className="stat"><div className="v">{dayKcal}</div><div className="k">kcal / day</div></div>
            <div className="stat"><div className="v">{dayProtein}g</div><div className="k">protein</div></div>
          </div>

          <div className="stack">
            {slots.map((slot) => {
              const r = allRecipesById[today[slot]]
              if (!r) return null
              return (
                <Link key={slot} to={`/recipes/${r.id}`} className="card">
                  <div className="card-row">
                    <div className="thumb">{slotIcon[slot]}</div>
                    <div className="card-body">
                      <span className="eyebrow">{slot}</span>
                      <h3>{r.title}</h3>
                      <div className="meta"><span>{r.kcal} kcal</span><span className="dot">{r.protein}g protein</span></div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <p className="meta">{shopping.length} items across {recipes.length} recipes this week</p>
          <ul className="plain stack" style={{ marginTop: 12 }}>
            {shopping.map((line, i) => (
              <li key={i} className="card"><div className="card-row" style={{ padding: '12px 14px' }}>
                <span style={{ color: 'var(--accent)' }}>○</span>
                <div className="card-body"><h3 style={{ fontSize: 15, fontWeight: 500 }}>{line}</h3></div>
              </div></li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
