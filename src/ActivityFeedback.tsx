import { useEffect, useState } from 'react'
import { authApi } from './auth/api'
import { FEEL, RPE, FIELDS } from './pages/PostWorkout'

// #273/#285 — post-workout feedback capture for ANY completed session (device activity or gym),
// keyed by an id. Feedback-first when unsubmitted; collapses to a one-line summary after. Saving
// persists + triggers a coach review (server). Reuses the shared feel/RPE/fields model (#143).
export default function ActivityFeedback({ id, sport, date, heading = 'How did it go?', icuExisting }: { id: string; sport: string; date: string; heading?: string; icuExisting?: { feel?: string; rpe?: number; fields: Record<string, string> } | null }) {
  const [feel, setFeel] = useState<string | undefined>()
  const [rpe, setRpe] = useState<number | undefined>()
  const [fields, setFields] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [fromIcu, setFromIcu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    authApi.getActivityFeedback(id).then((f) => {
      if (f) { setFeel(f.feel); setRpe(f.rpe); setFields(f.fields || {}); setNote(f.note || ''); setSaved(true) }
      else if (icuExisting) { setFeel(icuExisting.feel); setRpe(icuExisting.rpe); setFields(icuExisting.fields || {}); setSaved(true); setFromIcu(true) } // already logged in intervals — show it, don't ask again
    }).catch(() => {}).finally(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, icuExisting])
  const sportFields = FIELDS[sport] || FIELDS.gym
  async function save() { await authApi.activityFeedback(id, { feel, rpe, fields, note, sport, date }).catch(() => {}); setSaved(true); setEditing(false) }
  if (!loaded) return null
  if (saved && !editing) {
    const summary = [feel, rpe ? `RPE ${rpe}` : null, ...Object.values(fields)].filter(Boolean).join(' · ')
    return (
      <div className="card pw-fbsum">
        <span>✅ Your feedback{fromIcu ? ' (from intervals)' : ''}: {summary || '—'}</span>
        <button className="auth-link" style={{ width: 'auto', padding: 0 }} onClick={() => setEditing(true)}>Edit</button>
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: '4px 14px 16px' }}>
      <div className="section-title">{heading}</div>
      <p className="meta" style={{ margin: '-4px 0 8px' }}>Log it — your coach reviews it right after you submit.</p>
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
      <button className="btn" style={{ marginTop: 14 }} onClick={save} disabled={!feel && !rpe}>Save &amp; get coach review</button>
    </div>
  )
}
