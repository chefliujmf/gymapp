import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPlanEvent, gymSessionFromEvent, setGymSession } from '../plan'
import { eventObjective, parseGymTable, sportOf, flattenIcuSteps } from '../intervals'
import { setCurrentRide } from '../ride'
import { getSetting } from '../db'

export default function PlanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const e = id ? getPlanEvent(id) : undefined
  const [notes, setNotes] = useState(false)

  if (!e) return <div className="page-head"><Link to="/" className="back">← Today</Link><h1>Plan not found</h1><p className="meta">Open it from Today so it can load.</p></div>

  const sport = sportOf(e)
  const obj = eventObjective(e)
  const gym = parseGymTable(e.description || '')
  const isRide = (sport === 'cycling' || e.type === 'Run') && (e.workout_doc?.steps?.length ?? 0) > 0
  const mins = e.moving_time ? Math.round(e.moving_time / 60) : undefined

  function startGym() { setGymSession(gymSessionFromEvent(e!)); navigate('/gym-session/play') }
  async function startRide() {
    const ftp = Number(await getSetting('ftp')) || 260
    setCurrentRide({ title: e!.name, sport: e!.type === 'Run' ? 'running' : 'cycling', segments: flattenIcuSteps(e!.workout_doc?.steps), ftp, source: 'icu-' + e!.id })
    navigate('/ride-player')
  }

  return (
    <div>
      <Link to="/" className="back">← Today</Link>
      <div className="page-head">
        <span className="eyebrow">{e.category === 'TARGET' ? 'Target' : sport === 'gym' ? 'Gym' : sport === 'cycling' ? 'Ride' : e.type} · {new Date(e.start_date_local).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        <h1>{e.name}</h1>
      </div>

      {(mins || e.icu_training_load) && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          {mins ? <div className="stat"><div className="v">{mins}</div><div className="k">min</div></div> : null}
          {e.icu_training_load ? <div className="stat"><div className="v">{e.icu_training_load}</div><div className="k">TSS</div></div> : null}
        </div>
      )}

      {obj && <p className="lead" style={{ marginTop: 12 }}>{obj}</p>}

      {gym.length > 0 && (
        <>
          <button className="btn" onClick={startGym}>▶ Start workout</button>
          <div className="section-title">Main set</div>
          <div className="stack" style={{ gap: 8 }}>
            {gym.map((r, i) => (
              <div key={i} className="card" style={{ padding: '12px 14px' }}>
                <div className="meta" style={{ marginBottom: 2 }}>{r.type}</div>
                <h3 style={{ fontSize: 15, margin: 0 }}>{r.exercise}</h3>
                <div className="meta" style={{ marginTop: 4 }}>
                  <span><b style={{ color: 'var(--ink,#111)' }}>{r.sets}×{r.reps}</b></span>
                  {r.rest && <span className="dot">rest {r.rest}</span>}
                </div>
                {r.cue && <div className="meta" style={{ display: 'block', whiteSpace: 'normal', marginTop: 4 }}>{r.cue}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {isRide && <button className="btn" style={{ marginTop: 14 }} onClick={startRide}>▶ Ride now (indoor)</button>}

      {e.description && (
        <>
          <button className="see-all" style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 16, padding: 0 }} onClick={() => setNotes((n) => !n)}>
            {notes ? '▾ Coach notes' : '› Coach notes (fueling, cues, recovery)'}
          </button>
          {notes && <pre className="coach-notes">{e.description}</pre>}
        </>
      )}
    </div>
  )
}
