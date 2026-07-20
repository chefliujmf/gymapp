import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi, type CoachReview } from './auth/api'
import { FEEL, RPE, FIELDS } from './pages/PostWorkout'

// #273/#285 — post-workout feedback capture for ANY completed session (device activity or gym),
// keyed by an id. Feedback-first when unsubmitted; collapses to a one-line summary after. Saving
// persists + triggers a coach review (server). Reuses the shared feel/RPE/fields model (#143).
export default function ActivityFeedback({ id, sport, date, heading = 'How did it go?', icuExisting, icuNote, onSaved, reviewShownAbove = false, altIds = [] }: { id: string; sport: string; date: string; heading?: string; icuExisting?: { feel?: string; rpe?: number; fields: Record<string, string> } | null; icuNote?: string; onSaved?: () => void; reviewShownAbove?: boolean; altIds?: string[] }) {
  const [feel, setFeel] = useState<string | undefined>()
  const [rpe, setRpe] = useState<number | undefined>()
  const [fields, setFields] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [fromIcu, setFromIcu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [review, setReview] = useState<CoachReview | null>(null) // #364 the coach's review of THIS session
  const [reviewing, setReviewing] = useState(false) // #364 "coach is reviewing…" right after you submit
  // Match the coach review for this session (by date + sport; gym reviews may omit sport).
  const matchReview = (rs: CoachReview[]) => rs.find((r) => r.date === date && (r.sport === sport || (!r.sport && sport === 'gym'))) || null
  const foundRef = useRef(false) // once feedback is found under any key, don't reload (a later dep change won't clobber edits)
  useEffect(() => {
    // Robust load: the canonical id first, then any LEGACY keys the same session may have been saved under (activity
    // id vs gym-date-workoutId, entered from different views) — so feedback never "vanishes". Re-runs when the
    // candidate keys change (e.g. the device activity id arrives async), until found. Save always writes the
    // canonical `id`, so an edit consolidates it. (#feedback-key-audit)
    if (!foundRef.current) (async () => {
      const keys = [id, ...altIds.filter((k) => k && k !== id)]
      let f: Awaited<ReturnType<typeof authApi.getActivityFeedback>> = null
      for (const k of keys) { f = await authApi.getActivityFeedback(k).catch(() => null); if (f) break }
      if (f) { foundRef.current = true; setFeel(f.feel); setRpe(f.rpe); setFields(f.fields || {}); setNote(f.note || ''); setSaved(true) }
      else if (icuExisting || icuNote) { foundRef.current = true; setFeel(icuExisting?.feel); setRpe(icuExisting?.rpe); setFields(icuExisting?.fields || {}); if (icuNote) setNote(icuNote); setSaved(true); setFromIcu(true) } // already logged in intervals — show it, don't ask again
      setLoaded(true)
    })()
    authApi.coachReviews().then((rs) => setReview(matchReview(rs))).catch(() => {}) // #364 show an existing review if there is one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, altIds.join('|'), icuExisting, icuNote])
  const sportFields = FIELDS[sport] || FIELDS.gym
  // #364 — after saving, tell the athlete the coach IS reviewing + poll so the takeaways appear here
  // (no reload) the moment they land — the coach review runs async server-side (~1–3 min).
  // #364/#589 — poll for the coach's review after a submit OR a retry. On give-up, we DON'T just fall silent — the
  // render offers a "Retry" (when saved + no review + not polling), so a stuck review (e.g. the coach was down) is recoverable.
  function startReviewPoll(prevAt: string) {
    setReviewing(true)
    let tries = 0
    const poll = () => authApi.coachReviews().then((rs) => {
      const m = matchReview(rs)
      if (m && m.at > prevAt) { setReview(m); setReviewing(false); return } // a FRESH review landed
      if (++tries < 20) setTimeout(poll, 10000); else setReviewing(false)
    }).catch(() => { if (++tries < 20) setTimeout(poll, 10000); else setReviewing(false) })
    setTimeout(poll, 7000)
  }
  async function save() {
    const prevAt = review?.at || ''
    await authApi.activityFeedback(id, { feel, rpe, fields, note, sport, date }).catch(() => {})
    setSaved(true); setEditing(false)
    if (onSaved) setTimeout(onSaved, 800) // #442b — came from /review → knock-out loop: brief "saved" then back to the list
    startReviewPoll(prevAt)
  }
  // #589 — re-run a coach review that never landed (coach was down / errored). Re-triggers server-side, then re-polls.
  async function retryReview() {
    try { await authApi.retryReview(id); startReviewPoll(review?.at || '') }
    catch { /* leave the retry button so they can try again */ }
  }
  // #364 — the review / "reviewing…" block shown under the collapsed feedback, so you always know
  // the coach saw it + WHERE the takeaways will appear.
  const score10 = review && review.score != null ? (review.score > 10 ? Math.round(review.score / 10) : review.score) : null
  const reviewBlock = review ? (reviewShownAbove ? null : ( // #503/#JM — when CoachVerdict shows the review ABOVE, don't duplicate it here; the "See all takeaways" link is gone (JM 2026-07-15)
    <div className="pw-fbrev">
      <div className="pw-fbrev__h">💬 Your coach reviewed this{score10 != null ? <span className="pw-fbrev__score">{score10}/10</span> : null}</div>
      {review.verdict && <p className="pw-fbrev__v">{review.verdict}</p>}
      {review.takeaways && review.takeaways.length > 0 && <ul className="pw-fbrev__l">{review.takeaways.slice(0, 3).map((t, i) => <li key={i}>{t}</li>)}</ul>}
    </div>
  )) : reviewing ? (
    <div className="pw-fbrev pw-fbrev--pending"><div className="pw-fbrev__h">🔎 Your coach is reviewing this session…</div><p className="pw-fbrev__v">Takeaways will appear <b>right here</b>{sport === 'gym' ? <>, on <Link to="/progress" className="pw-fbrev__link">Progress</Link></> : null}, and as a 🔔 notification — usually within a minute or two.</p></div>
  ) : saved ? (
    // #589 — saved but NO review landed + not polling = it's stuck (coach was down / errored). Offer a RETRY instead of
    // a dead-end "takeaways will show here" that never fills.
    <div className="pw-fbrev pw-fbrev--pending">
      <p className="pw-fbrev__v">Your coach hasn’t reviewed this yet.</p>
      <button className="btn btn--ghost" style={{ width: 'auto', padding: '6px 14px', marginTop: 6 }} onClick={retryReview}>🔁 Retry coach review</button>
    </div>
  ) : null
  if (!loaded) return null
  if (saved && !editing) {
    const feelF = FEEL.find(([l]) => l === feel)?.[1]
    const headline = [feelF ? `${feelF} ${feel}` : feel, rpe ? `RPE ${rpe}` : null].filter(Boolean).join(' · ')
    const tags = Object.values(fields).filter(Boolean)
    return (
      <div className="card pw-fbsum">
        <div className="pw-fbsum__top">
          <span className="pw-fbsum__h">✅ Your feedback{fromIcu ? ' · from intervals' : ''}</span>
          <button className="auth-link" style={{ width: 'auto', padding: 0 }} onClick={() => setEditing(true)}>Edit</button>
        </div>
        <div className="pw-fbsum__hl">{headline || '—'}</div>
        {tags.length > 0 && <div className="pw-fbsum__tags">{tags.map((t, i) => <span key={i} className="pw-tag">{t}</span>)}</div>}
        {note && <p className="pw-fbsum__note">“{note}”</p>}
        {reviewBlock}
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
