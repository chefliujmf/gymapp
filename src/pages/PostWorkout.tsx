import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCoachPlan } from '../plan'
import { authApi } from '../auth/api'
import { fetchActivities, sportOfActivity, type IcuActivity } from '../intervals'
import { DoneStats } from '../ui'

// Intervals.icu "Feel" scale (Strong/Good/Normal/Poor/Weak), mirrored backend-side.
// Exported so Log-activity shares ONE feedback model + coach pipeline (#143).
export const FEEL: [string, string][] = [['Strong', '😎'], ['Good', '🙂'], ['Normal', '😐'], ['Poor', '🙁'], ['Weak', '😵']]
const RPE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
// RIDE/RUN feedback MIRRORS the athlete's intervals.icu custom ACTIVITY_FIELDs exactly (#147) —
// names + option lists fetched 2026-06-26 from /athlete/{id}/custom-item (type ACTIVITY_FIELD).
export const ICU_FIELDS: [string, string[]][] = [
  ['Legs Before', ['fresh', 'normal', 'relaxed', 'heavy', 'sore', 'flat', 'tired']],
  ['Legs After', ['strong', 'normal', 'tired OK', 'barely tired', 'heavy', 'sore', 'cooked']],
  ['Fuel/GI', ['not needed', 'water only OK', 'carbs OK', 'underfueled', 'GI issue', 'too much fuel']],
  ['Pain/Niggles', ['none', 'knee', 'back', 'neck/shoulder', 'foot', 'saddle', 'other']],
  ['Life Constraint', ['none', 'time cap', 'family', 'work', 'poor sleep', 'stress', 'weather', 'other']],
  ['Mental State', ['calm', 'focused', 'impatient', 'overexcited', 'doubtful', 'frustrated', 'checked out']],
]
// intervals field CODE for each label — kept so a future write-back can POST the right custom field.
export const ICU_FIELD_CODES: Record<string, string> = { 'Legs Before': 'LegsBefore', 'Legs After': 'LegsAfter', 'Fuel/GI': 'FuelGI', 'Pain/Niggles': 'PainNiggles', 'Life Constraint': 'LifeConstraint', 'Mental State': 'MentalState' }
// GYM is its OWN set, NOT cycling's (#152 — "gym is not the same as cycling, as discussed"):
// gym-specific Soreness/pump + Form, then the universal context fields (gym-relevant Pain/Niggles,
// Life Constraint, Mental State). No Legs/Fuel — those are endurance-only.
export const GYM_FIELDS: [string, string[]][] = [
  ['Soreness/pump', ['none', 'light', 'good pump', 'sore', 'very sore']],
  ['Form', ['clean', 'mostly clean', 'broke down']],
  ['Pain/Niggles', ['none', 'shoulder', 'low back', 'knee', 'wrist', 'elbow', 'other']],
  ['Life Constraint', ['none', 'time cap', 'family', 'work', 'poor sleep', 'stress', 'weather', 'other']],
  ['Mental State', ['calm', 'focused', 'impatient', 'overexcited', 'doubtful', 'frustrated', 'checked out']],
]
export const FIELDS: Record<string, [string, string[]][]> = { ride: ICU_FIELDS, run: ICU_FIELDS, gym: GYM_FIELDS }

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
  useEffect(() => { if (p) fetchActivities(p.date, p.date).then((a) => setAct(a.find((x) => sportOfActivity(x) === p.sport))).catch(() => {}) }, [p?.date, p?.sport])

  if (!p) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button><h1>Plan not found</h1><p className="meta">Open it from Today.</p></div>
  const sportFields = FIELDS[p.sport] || FIELDS.gym

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
