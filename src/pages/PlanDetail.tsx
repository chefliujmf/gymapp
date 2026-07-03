import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPlanEvent, gymSessionFromEvent, setGymSession, matchExercise } from '../plan'
import { eventObjective, parseGymTable, parseGymWorkout, sportOf, flattenIcuSteps, type GymTableRow } from '../intervals'
import { MiniProfile } from '../ui'
import { workoutSummary, structureRows, plannedSeries, plannedLoad } from '../workout-summary'
import { TrendChart, minuteTicks } from '../charts'
import { setCurrentRide, canPlayHere } from '../ride'
import { useBle } from '../BleContext'
import { getSetting } from '../db'
import { useAuth } from '../auth/AuthContext'
import { gymTSS, rpeIntensity } from '../tss'

/** Render the [gymapp] inline/bullet format as the same rows the table path uses. */
function rowsFromGymapp(description: string): GymTableRow[] {
  const spec = parseGymWorkout(description)
  if (!spec) return []
  return spec.exercises.map((x): GymTableRow => ({
    type: x.mode === 'reps' ? 'Strength' : 'Work',
    exercise: x.name,
    sets: x.mode === 'reps' ? x.sets : undefined,
    reps: x.mode === 'reps' ? `${x.reps ?? ''}${x.weight ? ` @ ${x.weight}kg` : ''}` : `${x.work}s`,
    rest: x.rest ? `${x.rest}s` : undefined,
  }))
}

export default function PlanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ble = useBle()
  const { user } = useAuth()
  const e = id ? getPlanEvent(id) : undefined
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (i: number) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  const [ftp, setFtp] = useState<number>()
  useEffect(() => { getSetting('ftp').then((v) => setFtp(Number(v) || undefined)) }, [])

  if (!e) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button><h1>Plan not found</h1><p className="meta">Open it from Today so it can load.</p></div>

  const sport = sportOf(e)
  const obj = eventObjective(e)
  // Coach events come in two flavours: a "## Main Set" markdown table, OR the
  // [gymapp] inline/bullet format. Use the table if present, else fall back to
  // the [gymapp] parser so the workout never renders empty.
  const gymTable = parseGymTable(e.description || '')
  const gym = gymTable.length > 0 ? gymTable : rowsFromGymapp(e.description || '')
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
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isRide && flattenIcuSteps(e.workout_doc?.steps).length > 0 && <div className="act-thumb"><MiniProfile segs={flattenIcuSteps(e.workout_doc?.steps)} /></div>}
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{kind} · {dateLabel}{mins ? ` · ${mins} min` : ''}{e.icu_training_load ? ` · ${e.icu_training_load} TSS` : (sport === 'gym' && mins ? ` · ~${gymTSS(mins, rpeIntensity(e.description || ''))} TSS` : '')}</span>
          <h1 style={{ margin: 0 }}>{e.name}</h1>
        </div>
      </div>

      {obj && !isRide && <p className="lead" style={{ marginTop: 4 }}>{obj}</p>}

      {gym.length > 0 && (
        <>
          <button className="btn" onClick={startGym}>▶ Start workout</button>
          <div className="section-title">Exercises</div>
          <p className="meta" style={{ margin: '-4px 2px 8px' }}>Tap an exercise to preview the demo & cues.</p>
          <div className="stack" style={{ gap: 8 }}>
            {gym.map((r, i) => {
              const demo = matchExercise(r.exercise)
              const isOpen = open.has(i)
              return (
                <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="ex-row" style={{ alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggle(i)}>
                    <div className="ex-thumb-sm" style={demo?.image ? { backgroundImage: `url(${demo.image})` } : undefined}>
                      {!demo?.image && '🏋️'}
                      {demo?.video && <span className="ex-play-sm">▶</span>}
                    </div>
                    <div className="ex-row-text" style={{ flex: 1 }}>
                      <div className="eyebrow" style={{ fontSize: 11 }}>{r.type}</div>
                      <h4>{r.exercise}</h4>
                      <div className="meta" style={{ marginTop: 2 }}>
                        <span><b style={{ color: 'var(--ink,#111)' }}>{r.sets != null ? `${r.sets}×${r.reps}` : r.reps}</b></span>
                        {r.rest && <span className="dot">rest {r.rest}</span>}
                      </div>
                    </div>
                    <span style={{ opacity: 0.4, padding: '2px 4px' }}>{isOpen ? '▾' : '›'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 12px 12px' }}>
                      {demo?.video
                        ? <video className="ex-video-inline" src={demo.video} poster={demo.image} controls autoPlay loop muted playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} />
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

      {isRide && (() => {
        const segs = flattenIcuSteps(e.workout_doc?.steps)
        const rFtp = ftp || user?.ftp || 200
        const rEst = !(ftp || user?.ftp)
        const sum = workoutSummary(segs, rFtp)
        const rows = structureRows(segs, rFtp)
        const load = plannedLoad(segs, rFtp)
        const totalSec = segs.reduce((s, x) => s + (Number(x.duration) || 0), 0)
        const keySet = rows.filter((r) => r.pct >= 88).sort((a, b) => b.durationSec * b.count - a.durationSec * a.count)[0]
        const fmtDur = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`)
        const hero: [string, string][] = [
          load ? ['Target TSS', String(load.tss)] : null,
          load ? ['Target IF', load.if.toFixed(2)] : null,
          sum ? ['Duration', `${sum.durationMin} min`] : null,
          keySet ? ['Key-set target', keySet.watts ? `${keySet.watts} W` : `${keySet.pct}%`] : (sum ? ['Main target', sum.mainWatts ? `${sum.mainWatts} W` : `${sum.mainPct}%`] : null),
        ].filter(Boolean) as [string, string][]
        const chips: [string, string][] = [
          keySet ? [keySet.count > 1 ? `${keySet.count}× ${fmtDur(keySet.durationSec)}` : fmtDur(keySet.durationSec), 'key set'] : null,
          sum ? [sum.mainZone, 'zone'] : null,
          rEst ? ['est FTP', 'set yours ⚙'] : null,
        ].filter(Boolean) as [string, string][]
        return (
        <>
          {obj && <div className="act-ins"><span className="tag">What to expect</span>{obj}</div>}
          <div className="act-hero">{hero.map(([l, v]) => <div key={l} className="ht"><b>{v}</b><span>{l}</span></div>)}</div>
          {chips.length > 0 && <div className="act-chips">{chips.map(([l, v]) => <span key={l} className="act-chip"><b>{v}</b><span>{l}</span></span>)}</div>}
          <div className="tl-card" style={{ marginTop: 8 }}>
            <div className="tl-clabel">PLANNED POWER · W · target shape</div>
            <TrendChart series={[{ label: 'Target', data: plannedSeries(segs, rFtp), color: '#34e07d', area: true }]} height={150} axes unit=" W" xTicks={minuteTicks(totalSec)} straight minSpan={Math.max(40, Math.round(rFtp * 0.35))} />
            {sum && <div className="act-ins"><span className="tag">💡</span>{sum.mainPct >= 91 ? 'Warm up fully — first hard effort controlled, not a shock; keep recoveries easy.' : 'Hold steady targets — smooth and repeatable beats spiky.'}</div>}
          </div>
          {rows.length > 1 && (
            <>
              <div className="section-title">Structure</div>
              <div className="stack" style={{ gap: 6 }}>
                {rows.map((r, i) => (
                  <div key={i} className="pw-ivrow"><span className="pw-zt">{r.zone}</span><span>{r.count > 1 ? `${r.count}× ` : ''}{r.label} · {fmtDur(r.durationSec)}</span><b>{r.watts ? `${r.watts} W` : `${r.pct}%`}</b></div>
                ))}
              </div>
            </>
          )}
          {canPlayHere(!!ble.bridge)
            ? <button className="btn" style={{ marginTop: 10 }} onClick={startRide}>▶ Ride now</button>
            : <div className="phone-gate" style={{ marginTop: 10 }}>📱 Open Platyplus on your phone to ride — that's where your sensors connect.</div>}
        </>
        )
      })()}

      {/* The full coach narrative (fueling, recovery, mental focus) stays in
          intervals.icu — gymapp shows only what you need to execute. */}
    </div>
  )
}
