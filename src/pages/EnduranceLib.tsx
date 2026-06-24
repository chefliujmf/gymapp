import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { endurance } from '../data/catalog'
import type { EnduranceSport } from '../types'
import { EnduranceCard } from '../ui'
import { listRideTemplates, deleteRideTemplate, getSetting } from '../db'
import { setCurrentRide } from '../ride'

const CAP = 80

/** Shared library UI for a single endurance sport (cycling or running). */
export default function EnduranceLib({ sport, title }: { sport: EnduranceSport; title: string }) {
  const navigate = useNavigate()
  const [cat, setCat] = useState<string>('all')
  const [q, setQ] = useState('')
  const [ftp, setFtp] = useState(260)
  useEffect(() => { getSetting('ftp').then((v) => v && setFtp(Number(v))) }, [])

  const sportKey = sport === 'cycling' ? 'ride' : 'run'
  const builderPath = sportKey === 'ride' ? '/ride-builder' : '/run-builder'
  const playerPath = sport === 'cycling' ? '/ride-player' : '/run-player'
  const mine = useLiveQuery(() => listRideTemplates(sportKey), [sportKey]) ?? []

  const all = useMemo(() => endurance.filter((e) => e.sport === sport), [sport])
  const categories = useMemo(() => ['all', ...[...new Set(all.map((e) => e.category))].sort()], [all])
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter((e) => (cat === 'all' || e.category === cat) && (!needle || e.name.toLowerCase().includes(needle)))
  }, [all, cat, q])

  function play(t: (typeof mine)[number]) {
    setCurrentRide({ title: t.name, sport, segments: t.segments, ftp, source: `tpl-${t.id}` })
    navigate(playerPath)
  }

  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head">
        <h1>{title}</h1>
        <p>{all.length} structured {sport} workouts</p>
      </div>

      <Link to={builderPath} className="btn" style={{ marginBottom: 8 }}>＋ Build a {sportKey}</Link>

      {mine.length > 0 && (
        <>
          <div className="section-title">My {sportKey === 'ride' ? 'rides' : 'runs'}</div>
          <div className="stack" style={{ gap: 8 }}>
            {mine.map((t) => {
              const mins = Math.round(t.segments.reduce((s, x) => s + x.duration, 0) / 60)
              return (
                <div key={t.id} className="ex-row">
                  <div className="ex-row-text" style={{ flex: 1, cursor: 'pointer' }} onClick={() => play(t)}>
                    <h4>{t.name}</h4>
                    <div className="ex-rx">{mins} min · {t.segments.length} segments</div>
                  </div>
                  <div className="chips" style={{ margin: 0, gap: 2 }}>
                    <button className="chip" onClick={() => play(t)}>▶</button>
                    <button className="chip" onClick={() => navigate(`${builderPath}?id=${t.id}`)}>✎</button>
                    <button className="chip" style={{ color: 'var(--danger,#c00)' }} onClick={() => t.id && deleteRideTemplate(t.id)}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="section-title">Library</div>
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
