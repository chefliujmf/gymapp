import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { TrendChart } from '../charts'
import { e1rm } from '../strength'

interface ExSeries { name: string; points: { date: string; e1rm: number }[] }

export default function Strength() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.logs.orderBy('date').toArray())

  const exercises = useMemo<ExSeries[]>(() => {
    const byEx = new Map<string, { date: string; e1rm: number }[]>()
    for (const log of logs || []) {
      if (!log.sets || !log.exNames) continue
      for (const [idxStr, setArr] of Object.entries(log.sets)) {
        const name = log.exNames[Number(idxStr)]
        if (!name || !Array.isArray(setArr)) continue
        let best = 0
        for (const s of setArr) if (s.weight && s.reps) best = Math.max(best, e1rm(s.weight, s.reps))
        if (best > 0) { const a = byEx.get(name) || []; a.push({ date: log.date, e1rm: Math.round(best) }); byEx.set(name, a) }
      }
    }
    return [...byEx.entries()]
      .map(([name, points]) => ({ name, points: points.sort((a, b) => a.date.localeCompare(b.date)) }))
      .filter((e) => e.points.length >= 1)
      .sort((a, b) => b.points[b.points.length - 1].date.localeCompare(a.points[a.points.length - 1].date))
  }, [logs])

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Strength</h1><p>Estimated 1-rep max per exercise, from your logs</p></div>
      </div>
      <Link to="/logs" className="btn btn--ghost" style={{ marginBottom: 12 }}>📒 Session history — view & edit your logs ›</Link>

      {logs === undefined ? <p className="meta">Loading…</p> : !exercises.length ? (
        <div className="athlete-view" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 36 }}>🏋️</div>
          <p>No weighted sets logged yet. Log a gym workout with weight × reps and your estimated 1RM trend will build here.</p>
          <Link to="/train" className="btn" style={{ marginTop: 8 }}>Go train</Link>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {exercises.map((ex) => {
            const cur = ex.points[ex.points.length - 1].e1rm
            const pr = Math.max(...ex.points.map((p) => p.e1rm))
            const first = ex.points[0].e1rm
            const delta = cur - first
            return (
              <div key={ex.name} className="card" style={{ padding: '12px 14px' }}>
                <div className="str-head">
                  <h3 style={{ margin: 0 }}>{ex.name}</h3>
                  <div className="str-nums">
                    <span><b>{cur}</b> kg e1RM</span>
                    <span className="meta">PR {pr}{ex.points.length > 1 ? ` · ${delta >= 0 ? '+' : ''}${delta} since start` : ''}</span>
                  </div>
                </div>
                {ex.points.length > 1 && <TrendChart height={84} unit=" kg" labels={ex.points.map((p) => new Date(p.date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))} series={[{ label: '', color: 'var(--accent, #34e07d)', data: ex.points.map((p) => p.e1rm), area: true }]} />}
              </div>
            )
          })}
          <p className="meta" style={{ marginTop: 4 }}>e1RM = average of the Epley & Brzycki formulas (most accurate at 2–10 reps).</p>
        </div>
      )}
    </div>
  )
}
