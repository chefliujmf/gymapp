import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchActivity, fetchActivityStreams, cleanLatLng, sportOfActivity, isIndoorActivity, type IcuActivity, type ActivityStreams } from '../intervals'
import { TrendChart } from '../charts'
import FlybyMap from '../FlybyMap'

const fmtTime = (s?: number) => { if (!s) return '—'; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, '0')}` : `${m} min` }
// downsample a stream to ~300 points so the charts stay light + cursor indices align
function ds(a: (number | null)[] | undefined, max = 300): (number | null)[] {
  if (!a) return []
  if (a.length <= max) return a.map((v) => (v == null ? null : Number(v)))
  const step = a.length / max
  return Array.from({ length: max }, (_, i) => { const v = a[Math.floor(i * step)]; return v == null ? null : Number(v) })
}

const TL_ROWS = [
  { key: 'watts', label: 'Power', unit: ' W', color: '#34e07d', area: true },
  { key: 'heartrate', label: 'HR', unit: ' bpm', color: '#ff5d6c', area: false },
  { key: 'altitude', label: 'Altitude', unit: ' m', color: '#7a8699', area: true },
  { key: 'cadence', label: 'Cadence', unit: ' rpm', color: '#4aa3ff', area: false },
] as const

// #54: stacked power/HR/altitude/cadence charts sharing ONE scrubber (synced cursor).
function RideTimeline({ streams }: { streams: ActivityStreams }) {
  const [cur, setCur] = useState<number | null>(null)
  const rows = TL_ROWS.filter((r) => ((streams[r.key] as unknown[] | undefined)?.length || 0) > 1)
  if (!rows.length) return <p className="meta">No power / HR / altitude data for this activity.</p>
  const data: Record<string, (number | null)[]> = {}
  for (const r of rows) data[r.key] = ds(streams[r.key] as (number | null)[])
  const at = (key: string) => { const arr = data[key]; const v = cur != null ? arr[cur] : arr[arr.length - 1]; return v == null ? null : Math.round(v) }
  return (
    <div>
      <div className="tl-chips">{rows.map((r) => <div key={r.key} className="tl-chip"><span>{r.label}</span><b>{at(r.key) != null ? at(r.key) + r.unit : '—'}</b></div>)}</div>
      {rows.map((r) => (
        <div key={r.key} className="tl-card">
          <div className="tl-clabel">{r.label.toUpperCase()}{r.unit}</div>
          <TrendChart series={[{ label: r.label, data: data[r.key], color: r.color, area: r.area }]} height={56} cursor={cur} onHover={setCur} />
        </div>
      ))}
      <p className="meta" style={{ textAlign: 'center', fontSize: 11 }}>drag across to scrub — all charts move together</p>
    </div>
  )
}

// Post-workout activity detail (#51 map + flyby, #54 analytics).
export default function ActivityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [a, setA] = useState<IcuActivity | null>(null)
  const [streams, setStreams] = useState<ActivityStreams>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'map' | 'timeline'>('map')
  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([fetchActivity(id), fetchActivityStreams(id)])
      .then(([act, s]) => { setA(act); setStreams(s) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button><h1>Loading…</h1></div>
  if (!a) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button><h1>Activity not found</h1><p className="meta">It may not be on intervals, or you're not connected.</p></div>

  const track = cleanLatLng(streams.latlng)
  const hasTimeline = TL_ROWS.some((r) => ((streams[r.key] as unknown[] | undefined)?.length || 0) > 1)
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

      {(track.length > 1 || hasTimeline) && (
        <div className="act-tabs">
          {track.length > 1 && <button className={tab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>Map</button>}
          {hasTimeline && <button className={tab === 'timeline' || track.length <= 1 ? 'on' : ''} onClick={() => setTab('timeline')}>Timeline</button>}
        </div>
      )}

      {tab === 'map' && track.length > 1 && <div className="card" style={{ padding: 6 }}><FlybyMap track={track} /></div>}
      {(tab === 'timeline' || track.length <= 1) && hasTimeline && <RideTimeline streams={streams} />}
      {track.length <= 1 && !hasTimeline && <p className="meta">No GPS or sensor data for this activity{isIndoorActivity(a) ? ' (indoor)' : ''}.</p>}

      <div className="actstats">{stats.map(([l, v]) => <div key={l} className="actstat"><span>{l}</span><b>{v}</b></div>)}</div>

      <div className="links" style={{ marginTop: 12 }}>
        {a.id && <a className="done-link" href={`https://intervals.icu/activities/${a.id}`} target="_blank" rel="noreferrer">intervals ↗</a>}
        {a.strava_id && <a className="done-link" href={`https://www.strava.com/activities/${a.strava_id}`} target="_blank" rel="noreferrer">Strava ↗</a>}
      </div>
    </div>
  )
}
