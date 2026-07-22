import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchActivities, sportOfActivity, type IcuActivity } from '../intervals'
import { incompleteFeedback } from '../feedbackGaps'
import { authApi } from '../auth/api'
import { useAuth } from '../auth/AuthContext'

// #442b/#387/#340 — the DEDICATED "to review" page (JM: headline on Today, NOT buried in History; tap → the
// activity; back → where you were). A knock-out list, oldest first, each row deep-links to the activity's
// feedback with { from: '/review' } so ActivityDetail returns HERE after Save.
const SPORT_EMOJI: Record<string, string> = { ride: '🚴', run: '🏃', gym: '🏋️', swim: '🏊', other: '⏱️' }
const nameFor = (s: string) => (s === 'ride' ? 'Ride' : s === 'run' ? 'Run' : s === 'gym' ? 'Strength session' : 'Session')
const iso = (d: Date) => d.toISOString().slice(0, 10)
const dayLabel = (v?: string) => { try { return v ? new Date(v).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '' } catch { return '' } }
const statLine = (a: IcuActivity) => {
  const b: string[] = []
  if (a.moving_time) b.push(`${Math.round(a.moving_time / 60)} min`)
  if (a.distance) b.push(`${(a.distance / 1000).toFixed(1)} km`)
  if (a.icu_average_watts) b.push(`${Math.round(a.icu_average_watts)} W`)
  else if (a.average_heartrate) b.push(`${Math.round(a.average_heartrate)} bpm`)
  if (a.icu_training_load) b.push(`${Math.round(a.icu_training_load)} TSS`)
  return b.join(' · ')
}

export default function ReviewPage() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [acts, setActs] = useState<IcuActivity[]>([])
  // #723 — completed GYM sessions still lacking feedback (feedback lives in the Platyplus store, invisible to the
  // intervals-based endurance nag above) come from the server so a gym never silently drops out of the review loop.
  const [gymGaps, setGymGaps] = useState<{ date: string; title: string; planId?: string }[]>([])
  useEffect(() => { authApi.gymReviewGaps().then(setGymGaps).catch(() => {}) }, [])
  const [loaded, setLoaded] = useState(false)
  // #review-skip — sessions the athlete skips (server-persisted via user.feedbackSkips) + this session's local
  // skips, so a tapped row drops immediately without a refetch.
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  useEffect(() => { setSkipped(new Set((user?.feedbackSkips || []).map(String))) }, [user?.feedbackSkips])
  useEffect(() => {
    const now = new Date(), from = new Date(now); from.setDate(from.getDate() - 45)
    fetchActivities(iso(from), iso(now)).then(setActs).catch(() => {}).finally(() => setLoaded(true))
  }, [])
  const gaps = useMemo(() => incompleteFeedback(acts, skipped), [acts, skipped])
  const skip = (id: string) => { setSkipped((s) => new Set(s).add(id)); authApi.feedbackSkip(id).catch(() => {}) }

  return (
    <div>
      <button className="icon-btn" onClick={() => nav('/')} aria-label="Back to Today" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head">
        <h1>To review{gaps.length + gymGaps.length ? ` · ${gaps.length + gymGaps.length}` : ''}</h1>
        <p>Oldest first — a minute each, then your coach adapts your plan.</p>
      </div>
      {!loaded && <p className="meta">Loading…</p>}
      {loaded && !gaps.length && !gymGaps.length && <div className="empty"><div className="big">✅</div>All caught up — nothing to review.</div>}
      <div className="stack">
        {gymGaps.map((g) => (
          <div key={`gym-${g.date}`} className="fbrow">
            <Link to={g.planId ? `/coach/${g.planId}` : '/'} state={{ from: '/review' }} className="fbrow__lk">
              <div className="fbrow__th">🏋️</div>
              <div className="fbrow__b">
                <div className="fbrow__t">{g.title || 'Strength session'} · {dayLabel(g.date + 'T12:00:00')}</div>
                <div className="fbrow__m"><span className="fbmiss">how it felt</span></div>
              </div>
            </Link>
            <div className="fbrow__acts">
              <Link to={g.planId ? `/coach/${g.planId}` : '/'} state={{ from: '/review' }} className="fbrow__cta">Add →</Link>
            </div>
          </div>
        ))}
        {gaps.map(({ act, status }) => {
          const stats = statLine(act)
          return (
            <div key={String(act.id)} className="fbrow">
              <Link to={`/activity/${act.id}`} state={{ from: '/review' }} className="fbrow__lk">
                <div className="fbrow__th">{SPORT_EMOJI[sportOfActivity(act)] || '⏱️'}</div>
                <div className="fbrow__b">
                  <div className="fbrow__t">{act.name || nameFor(sportOfActivity(act))} · {dayLabel(act.start_date_local)}</div>
                  {stats && <div className="meta" style={{ fontSize: 12, margin: '1px 0 3px' }}>{stats}</div>}
                  <div className="fbrow__m">{status.missing.map((m) => <span key={m} className="fbmiss">{m}</span>)}</div>
                  <div className="fbprog"><i style={{ width: `${Math.max(6, status.pct)}%` }} /></div>
                </div>
              </Link>
              <div className="fbrow__acts">
                <Link to={`/activity/${act.id}`} state={{ from: '/review' }} className="fbrow__cta">Add →</Link>
                <button className="fbrow__skip" onClick={() => skip(String(act.id))} aria-label="Skip this one">Skip</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
