import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { exercises, exerciseCategories, exerciseEquipment, exerciseMuscles } from '../data/catalog'

const CAP = 120

export default function Exercises() {
  const [cat, setCat] = useState<string>('all')
  const [equip, setEquip] = useState<string>('all')
  const [muscle, setMuscle] = useState<string>('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return exercises.filter(
      (e) => (cat === 'all' || e.category === cat)
        && (equip === 'all' || e.equipment === equip)
        && (muscle === 'all' || e.muscle === muscle)
        && (!needle || e.name.toLowerCase().includes(needle) || (e.muscle || '').toLowerCase().includes(needle)),
    )
  }, [cat, equip, muscle, q])

  return (
    <div>
      <div className="page-head">
        <h1>Train</h1>
        <p>{exercises.length} exercises in your library</p>
      </div>

      <div className="seg">
        <Link to="/workouts" className="seg__btn">Workouts</Link>
        <span className="seg__btn seg__btn--active">Exercises</span>
      </div>

      <Link to="/build" className="btn" style={{ marginBottom: 10 }}>＋ Build a workout</Link>

      <input className="search" placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="chips">
        <button className={'chip' + (cat === 'all' ? ' chip--active' : '')} onClick={() => setCat('all')}>All</button>
        {exerciseCategories.map((c) => (
          <button key={c} className={'chip' + (cat === c ? ' chip--active' : '')} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div className="chips chips--scroll">
        <button className={'chip' + (equip === 'all' ? ' chip--active' : '')} onClick={() => setEquip('all')}>Any kit</button>
        {exerciseEquipment.map((c) => (
          <button key={c} className={'chip' + (equip === c ? ' chip--active' : '')} onClick={() => setEquip(c)}>{c}</button>
        ))}
      </div>

      <div className="chips chips--scroll">
        <button className={'chip' + (muscle === 'all' ? ' chip--active' : '')} onClick={() => setMuscle('all')}>Any muscle</button>
        {exerciseMuscles.map((m) => (
          <button key={m} className={'chip' + (muscle === m ? ' chip--active' : '')} onClick={() => setMuscle(m)}>{m}</button>
        ))}
      </div>

      <p className="meta" style={{ margin: '4px 2px 10px' }}>
        {list.length} exercise{list.length === 1 ? '' : 's'}{list.length > CAP ? ` — showing first ${CAP}` : ''}
      </p>

      <div className="stack" style={{ gap: 6 }}>
        {list.slice(0, CAP).map((e) => (
          <Link key={e.id} to={`/exercises/${e.id}`} className="ex-row">
            <div className="ex-thumb-xs" style={e.image ? { backgroundImage: `url(${e.image})` } : undefined} />
            <div className="ex-row-text">
              <h4>{e.name}</h4>
              <div className="ex-rx">{e.category}</div>
            </div>
          </Link>
        ))}
        {list.length === 0 && <p className="empty">No exercises match.</p>}
      </div>
    </div>
  )
}
