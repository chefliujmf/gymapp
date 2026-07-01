import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getCoachPlan, gymSessionFromPlan, setGymSession, matchExercise } from '../plan'
import { calApi, type CalItem } from '../calendar'
import { SegmentProfile } from '../ui'
import { workoutSummary, structureRows } from '../workout-summary'
import { setCurrentRide, canPlayHere } from '../ride'
import { useBle } from '../BleContext'
import { getSetting, db } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'
import { bestE1rmByExercise, weightForReps, roundLoad } from '../strength'
import { InfoDot } from '../charts'
import { fetchActivities, sportOfActivity, type IcuActivity } from '../intervals'
import { authApi, type CoachReview } from '../auth/api'
import ActivityFeedback from '../ActivityFeedback'
import CoachVerdict from '../CoachVerdict'
import { useAuth } from '../auth/AuthContext'

/** Detail view for a coach-authored Platyplus plan: the universal coaching shell
 *  (Objective · Fuel · Mind · Recovery · Success · Cues) + the sport-specific body
 *  (ride/run power profile · gym exercise list). Fuel/Mind reference the day's meal/
 *  mind calendar ITEMS (one source); the coach's strategy "why" opens a bottom sheet. */
export default function CoachPlanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ble = useBle()
  const { user } = useAuth()
  const logs = useLiveQuery(() => db.logs.toArray())
  const e1rmMap = bestE1rmByExercise(logs || [])
  const e1rmFor = (name: string) => e1rmMap.get(name) || [...e1rmMap.entries()].find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1]
  const p = id ? getCoachPlan(id) : undefined
  const [items, setItems] = useState<CalItem[]>([])
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [sheet, setSheet] = useState<{ title: string; body: string } | null>(null)
  const [ftp, setFtp] = useState<number>()
  // #285 — if this planned workout is DONE (a completed activity exists for its day+sport), show the
  // post-workout stuff: coach verdict + feedback + a link to the full analysis. Turns the planned view
  // into the post view once completed, instead of a bare notes dump.
  const [doneAct, setDoneAct] = useState<IcuActivity | null>(null)
  const [review, setReview] = useState<CoachReview | null>(null)
  useEffect(() => { if (p) calApi.items(p.date, p.date).then(setItems).catch(() => {}) }, [p?.date])
  useEffect(() => { getSetting('ftp').then((v) => setFtp(Number(v) || undefined)) }, [])
  useEffect(() => {
    if (!p) return
    fetchActivities(p.date, p.date).then((a) => setDoneAct(a.find((x) => sportOfActivity(x) === p.sport) || null)).catch(() => {})
    authApi.coachReviews().then((r) => setReview(r.find((x) => x.planId === p.id) || r.find((x) => x.date === p.date && (x.sport === p.sport || !x.sport)) || null)).catch(() => {})
  }, [p?.id, p?.date, p?.sport])

  if (!p) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button><h1>Plan not found</h1><p className="meta">Open it from Today so it can load.</p></div>

  const meals = items.filter((it) => it.type === 'meal')
  const minds = items.filter((it) => it.type === 'mind')
  const mins = Math.round((p.segments || []).reduce((s, x) => s + (Number(x.duration) || 0), 0) / 60)
  const dateLabel = new Date(p.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  const toggle = (i: number) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  const isEndurance = p.sport === 'ride' || p.sport === 'run'

  function startGym() { setGymSession(gymSessionFromPlan(p!)); navigate('/gym-session/play') }
  function startRide() { setCurrentRide({ title: p!.title, sport: p!.sport === 'run' ? 'running' : 'cycling', segments: p!.segments || [], ftp: p!.ftp || ftp || 260, source: p!.id }); navigate(p!.sport === 'run' ? '/run-player' : '/ride-player') }

  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head">
        <span className="eyebrow">{p.sport === 'gym' ? 'Gym' : p.sport === 'run' ? 'Run' : 'Ride'} · {dateLabel}{mins ? ` · ${mins} min` : p.sport === 'gym' && p.exercises ? ` · ${p.exercises.length} exercises` : ''}</span>
        <h1>{p.title}</h1>
      </div>

      {/* #285 — completed: coach verdict + feedback + link to the full analysis */}
      {(doneAct || review) && (
        <>
          <div className="done-badge" style={{ position: 'static', display: 'inline-block', marginBottom: 8 }}>✓ Completed</div>
          {review && <CoachVerdict review={review} />}
          {doneAct && <Link to={`/activity/${doneAct.id}`} className="btn btn--ghost" style={{ marginBottom: 8 }}>📊 See full analysis →</Link>}
          <ActivityFeedback id={doneAct ? String(doneAct.id) : `plan-${p.id}`} sport={p.sport} date={p.date} />
        </>
      )}

      {/* sport body */}
      {isEndurance && (p.segments?.length ?? 0) > 0 && (() => {
        const rFtp = p.ftp || ftp || user?.ftp || 200
        const rEst = !(p.ftp || ftp || user?.ftp)
        const sum = workoutSummary(p.segments!, rFtp)
        const rows = structureRows(p.segments!, rFtp)
        const fmtDur = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`)
        return (
        <>
          {/* #280 what to expect */}
          {sum && (
            <div className="pw-expect">
              <div className="pw-e"><b>{sum.mainWatts ? `${sum.mainWatts}` : `${sum.mainPct}%`}<small>{sum.mainWatts ? 'W' : ''}</small></b><span>Target{rEst ? ' (est)' : ''}</span></div>
              <div className="pw-e"><b>{sum.mainZone}</b><span>Zone</span></div>
              <div className="pw-e"><b>{sum.durationMin}<small>m</small></b><span>Duration</span></div>
            </div>
          )}
          <div className="card" style={{ padding: 16, marginTop: 6 }}><SegmentProfile segs={p.segments!} ftp={rFtp} ftpEstimated={rEst} /></div>
          <p className="meta" style={{ margin: '6px 2px 0', whiteSpace: 'normal' }}>💡 {p.cues?.[0] || (sum && sum.mainPct >= 91 ? 'Warm up fully — the first hard effort should feel controlled, not a shock; keep recoveries easy and let HR drop.' : 'Hold steady targets — smooth and repeatable beats spiky.')}</p>
          {/* #280 structure */}
          {rows.length > 1 && (
            <>
              <div className="section-title">Structure</div>
              <div className="stack" style={{ gap: 6 }}>
                {rows.map((r, i) => (
                  <div key={i} className="pw-ivrow">
                    <span className="pw-zt">{r.zone}</span>
                    <span>{r.count > 1 ? `${r.count}× ` : ''}{r.label} · {fmtDur(r.durationSec)}</span>
                    <b>{r.watts ? `${r.watts} W` : `${r.pct}%`}</b>
                  </div>
                ))}
              </div>
            </>
          )}
          {canPlayHere(!!ble.bridge)
            ? <button className="btn" style={{ marginTop: 10 }} onClick={startRide}>▶ {p.sport === 'run' ? 'Run' : 'Ride'} now</button>
            : <div className="phone-gate" style={{ marginTop: 10 }}>📱 Open Platyplus on your phone to {p.sport === 'run' ? 'run' : 'ride'} — that's where your sensors connect.</div>}
        </>
        )
      })()}
      {p.sport === 'gym' && (p.exercises?.length ?? 0) > 0 && (
        <>
          <button className="btn" onClick={startGym}>▶ Start workout</button>
          {p.tip && <div className="tipbanner">💡 <span><b>Session tip:</b> {p.tip}</span></div>}
          <div className="section-title">Exercises</div>
          <div className="stack" style={{ gap: 8 }}>
            {p.exercises!.map((x, i) => {
              const demo = matchExercise(x.name)
              const isOpen = open.has(i)
              return (
                <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="ex-row" style={{ alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggle(i)}>
                    <div className="ex-thumb-sm" style={demo?.image ? { backgroundImage: `url(${demo.image})` } : undefined}>{!demo?.image && '🏋️'}{demo?.video && <span className="ex-play-sm">▶</span>}</div>
                    <div className="ex-row-text" style={{ flex: 1 }}>
                      <h4>{x.name}</h4>
                      <div className="meta" style={{ marginTop: 2 }}><span><b>{(x.mode || 'reps') === 'timed' ? `${x.seconds || 40}s` : `${x.sets || 3}×${x.reps || 10}`}</b></span>{x.rest ? <span className="dot">rest {x.rest}s</span> : null}{(() => { const e = (x.mode || 'reps') !== 'timed' ? e1rmFor(x.name) : undefined; const t = e ? roundLoad(weightForReps(e.e1rm, x.reps || 10)) : null; return t ? <span className="dot">target ~{t} kg</span> : null })()}{x.tempo ? <span className="dot" style={{ color: 'var(--accent)' }}>tempo {x.tempo} <InfoDot text="Seconds per rep — eccentric · pause bottom · concentric · pause top (e.g. 3-1-1-0 = 3s lower, 1s pause, 1s lift, 0s top). A slower lower = more time under tension." /></span> : null}</div>
                      {x.tip && <div className="meta" style={{ marginTop: 4, color: 'var(--text-dim)', whiteSpace: 'normal' }}>💡 {x.tip}</div>}
                    </div>
                    <span style={{ opacity: 0.4, padding: '2px 4px' }}>{isOpen ? '▾' : '›'}</span>
                  </div>
                  {isOpen && demo && (
                    <div style={{ padding: '0 12px 12px' }}>
                      {demo.video ? <video className="ex-video-inline" src={demo.video} poster={demo.image} controls autoPlay loop muted playsInline /> : demo.image && <img className="ex-video-inline" src={demo.image} alt={x.name} />}
                      <Link to={`/exercises/${demo.id}`} className="see-all" style={{ display: 'inline-block', marginTop: 6 }}>Full exercise →</Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* coaching shell */}
      {p.objective && <div className="plansec"><span className="plansec__k">🎯 Objective</span><p className="plansec__v">{p.objective}</p></div>}

      {(p.fuel?.why || p.fuel?.supplements || meals.length > 0) && (
        <div className="plansec">
          <div className="plansec__h"><span className="plansec__k">🍽️ Fuel</span>{p.fuel?.why && <button className="why-chip" onClick={() => setSheet({ title: 'Fueling strategy', body: p.fuel!.why! })}>why ⓘ</button>}</div>
          {meals.length > 0 && (
            <div className="mealgrid">
              {meals.map((m) => (
                <Link key={m.id} to={m.refId ? `/recipes/${m.refId}` : '#'} state={m.why ? { coachPick: m.why } : undefined} className="mealchip">
                  <div className="mealchip__th">🍽️</div>
                  <div style={{ minWidth: 0 }}>{m.mealType && <div className="mealchip__slot">{m.mealType}</div>}<div className="mealchip__nm">{m.title}</div>{m.kcal ? <div className="mealchip__kcal">{m.kcal} kcal</div> : null}</div>
                </Link>
              ))}
            </div>
          )}
          {p.fuel?.supplements && <p className="plansec__v" style={{ marginTop: 6 }}>Supplements: {p.fuel.supplements}</p>}
        </div>
      )}

      {(p.mind?.why || minds.length > 0) && (
        <div className="plansec">
          <div className="plansec__h"><span className="plansec__k">🧠 Mind</span>{p.mind?.why && <button className="why-chip" onClick={() => setSheet({ title: 'Mental focus', body: p.mind!.why! })}>why ⓘ</button>}</div>
          {minds.map((s) => (
            <Link key={s.id} to={s.refId ? `/mind/${s.refId}` : '#'} state={s.why ? { coachPick: s.why } : undefined} className="mindrow">
              <span className="mindrow__play">▶</span>
              <span><span className="mindrow__nm">{s.title}</span>{s.minutes ? <span className="mindrow__sub"> · {s.minutes} min</span> : null}</span>
            </Link>
          ))}
        </div>
      )}

      {p.recovery && <div className="plansec"><span className="plansec__k">🛌 Recovery</span><p className="plansec__v">{p.recovery}</p></div>}
      {p.success && <div className="plansec"><span className="plansec__k">✓ Success</span><p className="plansec__v">{p.success}</p></div>}
      {p.cues && p.cues.length > 0 && <div className="plansec"><span className="plansec__k">💬 Cues</span><p className="plansec__v">{p.cues.join(' · ')}</p></div>}

      <Link to={`/feedback/${p.id}`} className="btn btn--ghost" style={{ marginTop: 18, display: 'block', textAlign: 'center' }}>✓ Done? Log how it went →</Link>

      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__bar" />
            <h3 style={{ margin: '0 0 8px' }}>{sheet.title}</h3>
            <p className="meta" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{sheet.body}</p>
            <button className="btn btn--ghost" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
