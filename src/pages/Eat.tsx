import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { recipes, allRecipesById } from '../data/catalog'
import PageHead from '../PageHead'
import { calApi, type CalItem } from '../calendar'
import { localISO } from '../date'
import { useAuth } from '../auth/AuthContext'
import type { Recipe } from '../types'

// Diet gate (#40): vegetarian sees veg+vegan; vegan sees vegan only; else everything.
export function dietAllows(pref: string | undefined, recipeDiet: string | undefined): boolean {
  const p = (pref || '').toLowerCase()
  const d = (recipeDiet || 'omnivore').toLowerCase()
  if (p === 'vegan') return d === 'vegan'
  if (p === 'vegetarian') return d === 'vegetarian' || d === 'vegan'
  return true
}

type Cat = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const CATS: Cat[] = ['breakfast', 'lunch', 'dinner', 'snack']
const catEmoji: Record<Cat, string> = { breakfast: '🍳', lunch: '🥗', dinner: '🍽️', snack: '🥤' }

// A meal pack = a named set of meals with a rolled-up kcal + protein total.
// Built from the real recipe library so it always reflects available recipes.
type Pack = { id: string; name: string; emoji: string; blurb: string; mealIds: string[] }
function buildPacks(): Pack[] {
  const byCat = (c: Cat) => recipes.filter((r) => r.category === c)
  const top = (arr: Recipe[], cmp: (a: Recipe, b: Recipe) => number) => [...arr].sort(cmp)[0]?.id
  const oneEach = (cmp: (a: Recipe, b: Recipe) => number) => CATS.map((c) => top(byCat(c), cmp)).filter(Boolean) as string[]
  return [
    { id: 'balanced', name: 'Balanced day', emoji: '🍽️', blurb: 'One of each — a simple full day', mealIds: CATS.map((c) => byCat(c)[0]?.id).filter(Boolean) as string[] },
    { id: 'protein', name: 'High-protein day', emoji: '💪', blurb: 'Highest-protein pick per meal', mealIds: oneEach((a, b) => (b.protein ?? 0) - (a.protein ?? 0)) },
    { id: 'light', name: 'Lighter day', emoji: '🥗', blurb: 'Lowest-kcal pick per meal', mealIds: oneEach((a, b) => (a.kcal ?? 0) - (b.kcal ?? 0)) },
  ].filter((p) => p.mealIds.length > 0)
}

const sumKcal = (ids: string[]) => ids.reduce((s, id) => s + (allRecipesById[id]?.kcal ?? 0), 0)
const sumProtein = (ids: string[]) => ids.reduce((s, id) => s + (allRecipesById[id]?.protein ?? 0), 0)

/** A meal pack card: rollup + expand to meals + assign every meal to a chosen day. */
function PackCard({ pack }: { pack: Pack }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(localISO())
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function addAll() {
    setBusy(true); setMsg('')
    try {
      for (const id of pack.mealIds) {
        const r = allRecipesById[id]
        if (r) await calApi.saveItem({ date, type: 'meal', title: r.title, refId: r.id, mealType: r.category, kcal: r.kcal })
      }
      setMsg(`✓ Added ${pack.mealIds.length} meals to ${date}`)
    } catch { setMsg('Could not add — are you signed in?') } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ display: 'block' }}>
      <button className="card-row" style={{ width: '100%', background: 'none', border: 'none', color: 'inherit', textAlign: 'left', padding: 0, cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div className="thumb">{pack.emoji}</div>
        <div className="card-body">
          <h3>{pack.name}</h3>
          <div className="meta"><span>{pack.mealIds.length} meals</span><span className="dot">{sumKcal(pack.mealIds)} kcal</span><span className="dot">{sumProtein(pack.mealIds)}g protein</span></div>
          <div className="meta" style={{ display: 'block' }}>{pack.blurb}</div>
        </div>
        <span style={{ color: 'var(--muted)' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="stack" style={{ gap: 6 }}>
            {pack.mealIds.map((id) => {
              const r = allRecipesById[id]; if (!r) return null
              return (
                <Link key={id} to={`/recipes/${r.id}`} className="card" style={{ padding: '10px 12px' }}>
                  <div className="card-row"><div className="thumb" style={{ width: 34, height: 34 }}>{catEmoji[r.category as Cat] ?? '🍽️'}</div>
                    <div className="card-body"><h3 style={{ fontSize: 15 }}>{r.title}</h3><div className="meta"><span>{r.category}</span><span className="dot">{r.kcal} kcal</span><span className="dot">{r.protein}g</span></div></div></div>
                </Link>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 10, borderRadius: 8, background: '#0f0f12', color: '#fff', border: '1px solid #2c2c34', fontSize: 16 }} />
            <button className="btn" style={{ width: 'auto', padding: '10px 16px' }} disabled={busy} onClick={addAll}>📅 Add day</button>
          </div>
          {msg && <p className="meta" style={{ marginTop: 8 }}>{msg}</p>}
        </div>
      )}
    </div>
  )
}

/** A single recipe row with an inline "add to a day" control. */
function MealRow({ r }: { r: Recipe }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(localISO())
  const [msg, setMsg] = useState('')
  async function add() {
    try { await calApi.saveItem({ date, type: 'meal', title: r.title, refId: r.id, mealType: r.category, kcal: r.kcal }); setMsg(`✓ ${date}`); setOpen(false) }
    catch { setMsg('Sign in to add') }
  }
  return (
    <div className="card" style={{ display: 'block' }}>
      <div className="card-row">
        <Link to={`/recipes/${r.id}`} className="thumb" style={{ textDecoration: 'none' }}>{r.thumbnail ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : (catEmoji[r.category as Cat] ?? '🍽️')}</Link>
        <Link to={`/recipes/${r.id}`} className="card-body" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="eyebrow">{r.category}</span><h3>{r.title}</h3>
          <div className="meta"><span>{r.kcal} kcal</span><span className="dot">{r.protein}g protein</span>{r.minutes ? <span className="dot">{r.minutes} min</span> : null}</div>
        </Link>
        <button className="entry-kebab" onClick={() => { setOpen((o) => !o); setMsg('') }} aria-label="Add to a day" title="Add to a day">＋</button>
      </div>
      {open && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 10, borderRadius: 8, background: '#0f0f12', color: '#fff', border: '1px solid #2c2c34', fontSize: 16 }} />
          <button className="btn" style={{ width: 'auto', padding: '10px 16px' }} onClick={add}>Add to day</button>
        </div>
      )}
      {msg && <p className="meta" style={{ marginTop: 6 }}>{msg}</p>}
    </div>
  )
}

const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return localISO(d) }

export default function Eat() {
  const { user } = useAuth()
  const diet = (user?.info as { diet?: string } | undefined)?.diet
  const [tab, setTab] = useState<'packs' | 'meals' | 'shop'>('packs')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Cat | 'all'>('all')
  const [span, setSpan] = useState(7)
  const [items, setItems] = useState<CalItem[]>([])
  const packs = useMemo(buildPacks, [])

  // Shopping list is generated from the meals you've actually ASSIGNED to days.
  useEffect(() => {
    if (tab !== 'shop') return
    const from = localISO(); const to = addDays(from, span - 1)
    calApi.items(from, to).then(setItems).catch(() => setItems([]))
  }, [tab, span])

  const meals = useMemo(() => recipes.filter((r) => dietAllows(diet, r.diet) && (cat === 'all' || r.category === cat) && (!q || r.title.toLowerCase().includes(q.toLowerCase()))).slice(0, 120), [q, cat, diet])

  const assignedMeals = items.filter((it) => it.type === 'meal' && it.refId)
  const shopping = useMemo(() => {
    const lines = new Map<string, number>()
    for (const it of assignedMeals) {
      const r = it.refId ? allRecipesById[it.refId] : undefined
      r?.ingredients?.forEach((i) => lines.set(i, (lines.get(i) ?? 0) + 1))
    }
    return [...lines.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [items])

  return (
    <div>
      <PageHead title="Eat" sub="Meal packs, recipes & a shopping list from your plan" />

      <div className="seg">
        <button className={'seg__btn' + (tab === 'packs' ? ' seg__btn--active' : '')} onClick={() => setTab('packs')}>Packs</button>
        <button className={'seg__btn' + (tab === 'meals' ? ' seg__btn--active' : '')} onClick={() => setTab('meals')}>Meals</button>
        <button className={'seg__btn' + (tab === 'shop' ? ' seg__btn--active' : '')} onClick={() => setTab('shop')}>Shopping</button>
      </div>

      {tab === 'packs' && (
        <>
          <p className="meta" style={{ margin: '4px 2px 10px' }}>Pre-built day packs — tap to see the meals, then add the whole day to your calendar.</p>
          <div className="stack">{packs.map((p) => <PackCard key={p.id} pack={p} />)}</div>
        </>
      )}

      {tab === 'meals' && (
        <>
          <input className="search" placeholder="Search meals…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            {(['all', ...CATS] as const).map((c) => (
              <button key={c} className={'chip' + (cat === c ? ' chip--active' : '')} onClick={() => setCat(c)}>{c === 'all' ? 'All' : c}</button>
            ))}
          </div>
          <p className="meta" style={{ margin: '4px 2px 10px' }}>{meals.length} meal{meals.length === 1 ? '' : 's'} · tap ＋ to add one to a day</p>
          <div className="stack">{meals.map((r) => <MealRow key={r.id} r={r} />)}{meals.length === 0 && <p className="empty">No meals match.</p>}</div>
        </>
      )}

      {tab === 'shop' && (
        <>
          <div className="chips">
            {[[7, 'This week'], [14, 'Next 14 days'], [3, 'Next 3 days']].map(([n, label]) => (
              <button key={n} className={'chip' + (span === n ? ' chip--active' : '')} onClick={() => setSpan(n as number)}>{label}</button>
            ))}
          </div>
          {assignedMeals.length === 0 ? (
            <p className="meta" style={{ marginTop: 12 }}>No meals assigned in this range yet. Add meals or a pack to your days (Packs / Meals tab), then the shopping list builds itself.</p>
          ) : (
            <>
              <p className="meta" style={{ marginTop: 4 }}>{shopping.length} items from {assignedMeals.length} assigned meals</p>
              <ul className="plain stack" style={{ marginTop: 12 }}>
                {shopping.map(([line, n], i) => (
                  <li key={i} className="card"><div className="card-row" style={{ padding: '12px 14px' }}>
                    <span style={{ color: 'var(--accent)' }}>○</span>
                    <div className="card-body"><h3 style={{ fontSize: 15, fontWeight: 500 }}>{line}{n > 1 ? <span className="meta" style={{ marginLeft: 8 }}>×{n}</span> : null}</h3></div>
                  </div></li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
