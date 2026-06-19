import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPlanEvent, gymSessionFromEvent, setGymSession, matchExercise } from '../plan'
import { eventObjective, parseGymTable, sportOf, flattenIcuSteps } from '../intervals'
import { SegmentProfile } from '../ui'
import { setCurrentRide } from '../ride'
import { getSetting } from '../db'
import { gymTSS, rpeIntensity } from '../tss'

export default function PlanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const e = id ? getPlanEvent(id) : undefined
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (i: number) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })

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

  const kind = e.category === 'TARGET' ? 'Target' : sport === 'gym' ? 'Gym' : sport === 'cycling' ? 'Ride' : e.type
  const dateLabel = new Date(e.start_date_local).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <div>
      <Link to="/" className="back">← Today</Link>
      <div className="page-head">
        <span className="eyebrow">{kind} · {dateLabel}{mins ? ` · ${mins} min` : ''}{e.icu_training_load ? ` · ${e.icu_training_load} TSS` : (sport === 'gym' && mins ? ` · ~${gymTSS(mins, rpeIntensity(e.description || ''))} TSS` : '')}</span>
        <h1>{e.name}</h1>
      </div>

      {obj && <p className="lead" style={{ marginTop: 4 }}>{obj}</p>}

      {gym.length > 0 && (
        <>
          <button className="btn" onClick={startGym}>▶ Start workout</button>
          <div className="section-title">Main set</div>
          <p className="meta" style={{ margin: '-4px 2px 8px' }}>Tap an exercise to preview the demo & cues.</p>
          <div className="stack" style={{ gap: 8 }}>
            {gym.map((r, i) => {
              const demo = matchExercise(r.exercise)
              const isOpen = open.has(i)
              return (
                <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="ex-row" style={{ alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggle(i)}>
                    <div className="ex-thumb-sm" style={demo?.image ? { backgroundImage: `url(${demo.image})` } : undefined}>
                      {demo?.video && <span className="ex-play-sm">▶</span>}
                    </div>
                    <div className="ex-row-text" style={{ flex: 1 }}>
                      <div className="eyebrow" style={{ fontSize: 11 }}>{r.type}</div>
                      <h4>{r.exercise}</h4>
                      <div className="meta" style={{ marginTop: 2 }}>
                        <span><b style={{ color: 'var(--ink,#111)' }}>{r.sets}×{r.reps}</b></span>
                        {r.rest && <span className="dot">rest {r.rest}</span>}
                      </div>
                    </div>
                    <span style={{ opacity: 0.4, padding: '2px 4px' }}>{isOpen ? '▾' : '›'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 12px 12px' }}>
                      {demo?.video
                        ? <video className="ex-video-inline" src={demo.video} poster={demo.image} controls autoPlay loop muted playsInline />
                        : demo?.image && <img className="ex-video-inline" src={demo.image} alt={r.exercise} />}
                      {r.cue && <p className="meta" style={{ whiteSpace: 'normal', marginTop: 8 }}><b>Coach:</b> {r.cue}</p>}
                      {(demo?.equipment || demo?.muscle) && (
                        <div className="chips" style={{ marginTop: 4 }}>
                          {[demo?.equipment, demo?.muscle, demo?.difficulty].filter(Boolean).map((x) => <span key={x} className="chip">{x}</span>)}
                        </div>
                      )}
                      {demo && <Link to={`/exercises/${demo.id}`} className="see-all" style={{ display: 'inline-block', marginTop: 6 }}>Full exercise →</Link>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {isRide && (
        <>
          <div className="card" style={{ padding: 16, marginTop: 6 }}>
            <SegmentProfile segs={flattenIcuSteps(e.workout_doc?.steps)} />
          </div>
          <button className="btn" style={{ marginTop: 10 }} onClick={startRide}>▶ Ride now</button>
          <p className="meta" style={{ marginTop: 8, textAlign: 'center' }}>Guided ERG workout on a smart trainer. Riding outdoors instead? It syncs from your bike computer.</p>
        </>
      )}

      {/* The full coach narrative (fueling, recovery, mental focus) stays in
          intervals.icu — gymapp shows only what you need to execute. */}
    </div>
  )
}
