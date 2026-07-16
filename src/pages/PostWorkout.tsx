import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCoachPlan, findGymLogForPlan, gymFeedbackKeys } from '../plan'
import { authApi, type CoachReview } from '../auth/api'
import { fetchActivities, sportOfActivity, type IcuActivity } from '../intervals'
import { DoneStats } from '../ui'
import { db, type WorkoutLog } from '../db'
import { bestE1rmByExercise } from '../strength'
import GymSummary from '../GymSummary'

// Feedback field defs now live in the shared, React-free module (used by the intervals reader too).
export { FEEL, RPE, ICU_FIELDS, ICU_FIELD_CODES, GYM_FIELDS, FIELDS } from '../icu-fields'
import { FEEL, RPE, FIELDS } from '../icu-fields'

/** Post-workout feedback for a completed coach plan — sport-dependent. Coach notes
 *  up top, then the intervals "Feel" + RPE + sport fields + free text. Saved to the
 *  plan (the coach reads it); intervals mirror happens backend-side. */
export default function PostWorkout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const p = id ? getCoachPlan(id) : undefined
  const [feel, setFeel] = useState<string>()
  const [rpe, setRpe] = useState<number>()
  const [fields, setFields] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [act, setAct] = useState<IcuActivity>()
  // #285 — for a completed GYM plan, show the rich unified summary (verdict + sets/PR + feedback),
  // not the old feel/RPE form. Load the local log + PR baseline + coach review.
  const [gymLog, setGymLog] = useState<WorkoutLog | null>(null)
  const [bestE1rm, setBestE1rm] = useState<Map<string, { e1rm: number; date: string }>>(new Map())
  const [review, setReview] = useState<CoachReview | null>(null)
  // fetch the day's device activity for EVERY sport incl. gym — a watch-recorded gym gives us HR + time (#NNN).
  useEffect(() => { if (p) fetchActivities(p.date, p.date).then((a) => setAct(a.find((x) => sportOfActivity(x) === p.sport))).catch(() => {}) }, [p?.date, p?.sport])
  useEffect(() => {
    if (!p || p.sport !== 'gym') return
    // #326 — resolve the completed log the SAME way the card/detail do (plan-id OR title+day), so the
    // rich summary shows even when the session was logged under a non-`plan-<id>` workoutId.
    db.logs.toArray().then((ls) => { setBestE1rm(bestE1rmByExercise(ls)); setGymLog(findGymLogForPlan(p, ls)) }).catch(() => {})
    authApi.coachReviews().then((r) => setReview(r.find((x) => x.planId === p.id) || r.find((x) => x.date === p.date && (x.sport === 'gym' || !x.sport)) || null)).catch(() => {})
  }, [p?.id, p?.date, p?.sport])

  if (!p) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button><h1>Plan not found</h1><p className="meta">Open it from Today.</p></div>
  const sportFields = FIELDS[p.sport] || FIELDS.gym

  // #285 rich gym completed view (when a log exists) — replaces the bare feel/RPE form.
  if (p.sport === 'gym' && gymLog) {
    const exLogs = (gymLog.exNames && gymLog.exNames.length
      ? gymLog.exNames.map((name, i) => ({ name, exId: gymLog.exIds?.[i], sets: gymLog.sets?.[i] || [] }))
      : Object.keys(gymLog.sets || {}).map((k) => ({ name: `Exercise ${Number(k) + 1}`, sets: gymLog.sets![Number(k)] || [] })))
    // Duration: a DEVICE activity's real moving_time is authoritative (the log's stored duration can be stale — e.g.
    // it was imported from an activity that was later deleted/replaced). Prefer the live device time, fall back to the
    // log. So a device-recorded gym always shows its real length, never a stale value. (#gym-duration-mirror)
    const devMin = Math.round((((act as { moving_time?: number; elapsed_time?: number } | undefined)?.moving_time || (act as { elapsed_time?: number } | undefined)?.elapsed_time || 0)) / 60)
    const durMin = devMin || gymLog.duration || 0
    return (
      <div>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
        <div className="page-head"><span className="eyebrow">Gym · ✓ Completed{durMin ? ` · ${durMin} min` : ''}</span><h1>{p.title}</h1></div>
        {(() => {
          const fk = gymFeedbackKeys({ date: gymLog.date, planId: p.id, activityId: act?.id, workoutId: gymLog.workoutId })
          return <GymSummary minutes={durMin} exercises={exLogs} review={review} bestE1rm={bestE1rm} feedbackId={fk.id} altFeedbackIds={fk.altIds} feedbackDate={gymLog.date} planId={p.id} activityId={act?.id != null ? String(act.id) : undefined} avgHr={(act as { icu_average_hr?: number; average_heartrate?: number } | undefined)?.icu_average_hr || (act as { average_heartrate?: number } | undefined)?.average_heartrate} />
        })()}
      </div>
    )
  }

  async function save() {
    setSaved(true)
    await authApi.planFeedback(p!.id, { feel, rpe, fields, note }).catch(() => {})
    setTimeout(() => navigate(-1), 650)
  }

  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head"><span className="eyebrow">✓ Completed</span><h1>{p.title}</h1></div>

      {act && <div className="card" style={{ padding: '12px 14px' }}><DoneStats a={act} /></div>}

      {(p.objective || p.recovery) && (
        <div className="card" style={{ padding: '12px 14px' }}>
          {p.objective && <p className="plansec__v" style={{ margin: 0, color: 'var(--text)' }}>🎯 {p.objective}</p>}
          {p.recovery && <p className="plansec__v" style={{ marginTop: 6 }}>🛌 {p.recovery}</p>}
        </div>
      )}

      <div className="section-title">How did you feel?</div>
      <div className="feelrow">{FEEL.map(([l, f]) => <button key={l} className={'feel' + (feel === l ? ' on' : '')} onClick={() => setFeel(l)}><span className="feel__f">{f}</span><span className="feel__l">{l}</span></button>)}</div>

      <div className="section-title">Effort (RPE)</div>
      <div className="rpe">{RPE.map((n) => <button key={n} className={'rpe__b' + (rpe === n ? ' on' : '')} onClick={() => setRpe(n)}>{n}</button>)}</div>

      {sportFields.map(([label, opts]) => (
        <div key={label}>
          <div className="section-title">{label}</div>
          <div className="chips">{opts.map((o) => <button key={o} className={'chip' + (fields[label] === o ? ' chip--active' : '')} onClick={() => setFields((f) => ({ ...f, [label]: o }))}>{o}</button>)}</div>
        </div>
      ))}

      <div className="section-title">Anything else?</div>
      <textarea className="fb-ta" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How the body felt, life context, niggles…" />

      <button className="btn" style={{ marginTop: 14 }} onClick={save} disabled={saved}>{saved ? 'Saved ✓' : 'Save'}</button>
    </div>
  )
}
