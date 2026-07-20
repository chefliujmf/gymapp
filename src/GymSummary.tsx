import { Link } from 'react-router-dom'
import { e1rm } from './strength'
import { matchExercise } from './plan'
import type { SetEntry } from './db'
import CoachVerdict from './CoachVerdict'
import ActivityFeedback from './ActivityFeedback'
import type { CoachReview } from './auth/api'
import type { CoachNote } from './intervals'

export interface GymExLog { name: string; exId?: string; sets: SetEntry[] }

// #285 — the shared GYM completed view: coach verdict + hero/chips + a coach insight + the
// by-exercise sets/PR cards + the feedback stack. Same #286 language as ActivityDetail (which is
// device rides/runs); gym's "analysis" is the sets/PRs, not a power timeline. Used by the GymPlayer
// done screen AND the revisit path (PostWorkout /feedback/:id).
export default function GymSummary({ minutes, exercises, review, note, bestE1rm, feedbackId, feedbackDate, altFeedbackIds, planId, activityId, avgHr }: {
  minutes: number
  exercises: GymExLog[]
  review?: CoachReview | null
  note?: CoachNote | null
  bestE1rm?: Map<string, { e1rm: number; date: string }>
  feedbackId: string       // canonical feedback key (gymFeedbackKey(date))
  feedbackDate: string
  altFeedbackIds?: string[] // legacy keys to fall back to on load (activity id, gym-date-workoutId)
  planId?: string          // #NNN — source links (matches ride/run): the coach plan this fulfilled
  activityId?: string      // …and the device activity (HR + time), if a watch recorded it
  avgHr?: number           // device average HR, shown as a chip
}) {
  const rows = exercises.map((ex) => {
    const ss = (ex.sets || []).filter((s) => s?.done && !s?.warmup && (s.reps || 0) > 0) // #591 warm-ups excluded from working stats
    const vol = ss.reduce((v, s) => v + (s.weight || 0) * (s.reps || 0), 0)
    const top = ss.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0))[0]
    const est = top?.weight ? Math.round(e1rm(top.weight, top.reps || 1)) : 0
    const lib = matchExercise(ex.name) as { muscle?: string; category?: string } | undefined
    const muscle = (lib?.muscle || lib?.category || '').toString()
    const best = bestE1rm?.get(ex.name)?.e1rm
    const pr = est > 0 && (best == null || est >= Math.round(best))
    return { name: ex.name, sets: ss, vol, est, muscle, pr }
  }).filter((e) => e.sets.length)

  const totVol = Math.round(rows.reduce((v, e) => v + e.vol, 0))
  const totSets = rows.reduce((s, e) => s + e.sets.length, 0)
  const totReps = rows.reduce((s, e) => s + e.sets.reduce((r, x) => r + (x.reps || 0), 0), 0)
  const maxVol = Math.max(1, ...rows.map((e) => e.vol))
  const muscles = [...new Set(rows.map((e) => e.muscle).filter(Boolean))]
  const prCount = rows.filter((e) => e.pr).length

  const hero: [string, string][] = [
    totVol > 0 ? ['Volume', `${totVol.toLocaleString()} kg`] : ['Exercises', String(rows.length)],
    ['Sets', String(totSets || '—')],
    ['Reps', String(totReps || '—')],
    ['Time', `${minutes} min`],
  ]
  const insight = totVol > 0
    ? `${totSets} sets · ${totVol.toLocaleString()} kg moved${prCount ? ` · ${prCount} PR${prCount > 1 ? 's' : ''} 🏅` : ''}. Recover well — protein tonight.`
    : `All ${rows.length} exercises done. Log your weights next time and I'll track volume & PRs for you.`

  return (
    <>
      {/* ONE coach block at the TOP (matches ride/run ActivityDetail #503): verdict → your feedback → source links. */}
      <CoachVerdict review={review} note={note} />
      <ActivityFeedback id={feedbackId} altIds={altFeedbackIds} sport="gym" date={feedbackDate} reviewShownAbove />
      {(planId || activityId) && (
        <div className="done-links">
          {planId && <Link className="done-link done-link--map" to={`/coach/${planId}`}>📋 Planned workout →</Link>}
          {activityId && <Link className="done-link" to={`/activity/${activityId}`}>📈 View activity (HR) →</Link>}
        </div>
      )}
      <div className="act-hero">{hero.map(([l, v]) => <div key={l} className="ht"><b>{v}</b><span>{l}</span></div>)}</div>
      {(muscles.length > 0 || prCount > 0 || !!avgHr) && (
        <div className="act-chips">
          {muscles.map((m) => <span key={m} className="act-chip"><b>{m}</b></span>)}
          {avgHr ? <span key="hr" className="act-chip"><b>{Math.round(avgHr)}</b><span>bpm avg</span></span> : null}
          {prCount > 0 && <span key="pr" className="act-chip"><b>{prCount}</b><span>PR{prCount > 1 ? 's' : ''} 🏅</span></span>}
        </div>
      )}
      <div className="act-ins"><span className="tag">💡</span>{insight}</div>

      {rows.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 16 }}>By exercise <span className="meta" style={{ fontWeight: 400 }}>· tap for progress</span></div>
          <div className="stack" style={{ gap: 8 }}>
            {rows.map((e, i) => (
              <Link key={i} to={`/exercise/${encodeURIComponent(e.name)}`} className="gym-exc">
                <div className="gym-exc__top"><strong>{e.name}{e.pr && <span className="pr-badge">PR 🏅</span>} <span style={{ color: 'var(--accent)' }}>›</span></strong>{e.est > 0 && <span className="meta" style={{ flex: 'none' }}>est 1RM {e.est} kg</span>}</div>
                <div className="gym-exc__sets">{e.sets.map((s) => `${s.weight ? s.weight + '×' : 'BW×'}${s.reps || 0}`).join(' · ')}{e.vol > 0 ? ` — ${e.vol.toLocaleString()} kg` : ''}</div>
                <div className="gymbar"><i style={{ width: `${Math.round((e.vol / maxVol) * 100)}%` }} /></div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
