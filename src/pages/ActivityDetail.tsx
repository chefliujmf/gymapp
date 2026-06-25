import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchActivity, fetchActivityLatLng, sportOfActivity, isIndoorActivity, type IcuActivity } from '../intervals'
import FlybyMap from '../FlybyMap'

const fmtTime = (s?: number) => { if (!s) return '—'; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, '0')}` : `${m} min` }

// Post-workout activity detail (#51): route on a real map + Strava-style flyby + stats.
export default function ActivityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [a, setA] = useState<IcuActivity | null>(null)
  const [track, setTrack] = useState<[number, number][]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([fetchActivity(id), fetchActivityLatLng(id)])
      .then(([act, t]) => { setA(act); setTrack(t) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button><h1>Loading…</h1></div>
  if (!a) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button><h1>Activity not found</h1><p className="meta">It may not be on intervals, or you're not connected.</p></div>

  const stats: [string, string][] = ([
    a.distance ? ['Distance', `${(a.distance / 1000).toFixed(1)} km`] : null,
    a.moving_time ? ['Time', fmtTime(a.moving_time)] : null,
    a.icu_average_watts ? ['Avg power', `${Math.round(a.icu_average_watts)} W`] : null,
    a.average_heartrate ? ['Avg HR', `${Math.round(a.average_heartrate)} bpm`] : null,
    a.total_elevation_gain ? ['Elevation', `${Math.round(a.total_elevation_gain)} m`] : null,
    a.icu_training_load ? ['TSS', String(a.icu_training_load)] : null,
  ].filter(Boolean)) as [string, string][]

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{sportOfActivity(a) === 'ride' ? 'Ride' : sportOfActivity(a) === 'run' ? 'Run' : 'Workout'} · {isIndoorActivity(a) ? 'Indoor' : 'Outdoor'}</span>
          <h1 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || 'Activity'}</h1>
        </div>
      </div>

      {track.length > 1
        ? <div className="card" style={{ padding: 6 }}><FlybyMap track={track} /></div>
        : <p className="meta">No GPS for this activity{isIndoorActivity(a) ? ' (indoor)' : ''}.</p>}

      <div className="actstats">{stats.map(([l, v]) => <div key={l} className="actstat"><span>{l}</span><b>{v}</b></div>)}</div>

      <div className="links" style={{ marginTop: 12 }}>
        {a.id && <a className="done-link" href={`https://intervals.icu/activities/${a.id}`} target="_blank" rel="noreferrer">intervals ↗</a>}
        {a.strava_id && <a className="done-link" href={`https://www.strava.com/activities/${a.strava_id}`} target="_blank" rel="noreferrer">Strava ↗</a>}
      </div>
    </div>
  )
}
