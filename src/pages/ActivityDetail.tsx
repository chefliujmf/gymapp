import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchActivity, fetchActivityStreams, fetchActivityThread, readIcuFeedback, cleanLatLng, sportOfActivity, isIndoorActivity, type IcuActivity, type ActivityStreams, type CoachNote } from '../intervals'
import { TrendChart, PowerCurveChart } from '../charts'
import { zoneColor } from '../ui'
import { getSetting } from '../db'
import { authApi, type CoachReview } from '../auth/api'
import ActivityFeedback from '../ActivityFeedback'
import CoachVerdict from '../CoachVerdict'
import FlybyMap from '../FlybyMap'

// #54 Power tab: mean-max power curve + time-in-zone, computed from the watts stream.
const CURVE_DURATIONS = [1, 5, 15, 30, 60, 300, 600, 1200, 1800, 3600]
function meanMaxCurve(watts: (number | null)[]): { secs: number[]; watts: number[] } {
  const w = watts.map((v) => (v == null ? 0 : Number(v)))
  const n = w.length
  const pre = [0]; for (let i = 0; i < n; i++) pre.push(pre[i] + w[i]) // prefix sums → O(1) window avg
  const secs: number[] = [], best: number[] = []
  for (const d of CURVE_DURATIONS) {
    if (d > n) continue
    let b = 0
    for (let i = 0; i + d <= n; i++) { const avg = (pre[i + d] - pre[i]) / d; if (avg > b) b = avg }
    secs.push(d); best.push(Math.round(b))
  }
  return { secs, watts: best }
}
const ZONES = ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO₂max', 'Anaerobic']
const zoneIdx = (pct: number) => (pct < 60 ? 0 : pct < 76 ? 1 : pct < 91 ? 2 : pct < 106 ? 3 : pct < 121 ? 4 : 5)
const ZONE_PCT = [50, 68, 83, 98, 113, 130] // a representative %FTP per zone → zoneColor
function zoneSecs(watts: (number | null)[], ftp: number): number[] {
  const z = [0, 0, 0, 0, 0, 0]
  for (const v of watts) { if (v == null) continue; z[zoneIdx((Number(v) / ftp) * 100)]++ }
  return z
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

function RidePower({ streams, ftp }: { streams: ActivityStreams; ftp: number }) {
  const watts = streams.watts || []
  if (watts.filter((v) => v != null).length < 5) return <p className="meta">No power data for this activity.</p>
  const curve = meanMaxCurve(watts)
  const zsec = zoneSecs(watts, ftp)
  const total = zsec.reduce((a, b) => a + b, 0) || 1
  return (
    <div>
      <div className="tl-card"><div className="tl-clabel">POWER CURVE · best avg by duration</div><PowerCurveChart secs={curve.secs} watts={curve.watts} height={170} /></div>
      <div className="tl-clabel" style={{ marginTop: 6 }}>TIME IN ZONE · FTP {ftp} W</div>
      <div className="zbar">{ZONES.map((_, i) => zsec[i] > 0 && <div key={i} style={{ width: `${(zsec[i] / total) * 100}%`, background: zoneColor(ZONE_PCT[i]) }} title={`${ZONES[i]} ${mmss(zsec[i])}`} />)}</div>
      <div className="zlist">{ZONES.map((z, i) => zsec[i] > 0 && (
        <div key={i} className="zrow"><span className="zdot" style={{ background: zoneColor(ZONE_PCT[i]) }} />{z}<b>{mmss(zsec[i])}</b><span className="meta">{Math.round((zsec[i] / total) * 100)}%</span></div>
      ))}</div>
    </div>
  )
}

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

// elapsed seconds → compact axis label (mm:ss, or h:mm over an hour)
const fmtElapsed = (s: number) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}` }

// #54: stacked power/HR/altitude/cadence charts sharing ONE scrubber. Each to the chart standard
// (#230): Y axis + a shared TIME x-axis + an avg/max insight in the label.
function RideTimeline({ streams }: { streams: ActivityStreams }) {
  const [cur, setCur] = useState<number | null>(null)
  const rows = TL_ROWS.filter((r) => ((streams[r.key] as unknown[] | undefined)?.length || 0) > 1)
  if (!rows.length) return <p className="meta">No power / HR / altitude data for this activity.</p>
  const data: Record<string, (number | null)[]> = {}
  for (const r of rows) data[r.key] = ds(streams[r.key] as (number | null)[])
  // shared time axis (from the time stream, downsampled to the same length); fallback to none
  const timeLabels = streams.time && streams.time.length > 1 ? ds(streams.time as number[]).map((v) => (v == null ? '' : fmtElapsed(v))) : undefined
  const at = (key: string) => { const arr = data[key]; const v = cur != null ? arr[cur] : arr[arr.length - 1]; return v == null ? null : Math.round(v) }
  const stat = (key: string) => { const v = data[key].filter((x): x is number => x != null); if (!v.length) return ''; const avg = Math.round(v.reduce((a, b) => a + b, 0) / v.length); return ` · avg ${avg} · max ${Math.round(Math.max(...v))}` }
  return (
    <div>
      <div className="tl-chips">{rows.map((r) => <div key={r.key} className="tl-chip"><span>{r.label}</span><b>{at(r.key) != null ? at(r.key) + r.unit : '—'}</b></div>)}</div>
      {rows.map((r) => (
        <div key={r.key} className="tl-card">
          <div className="tl-clabel">{r.label.toUpperCase()}{r.unit}{stat(r.key)}</div>
          <TrendChart series={[{ label: r.label, data: data[r.key], color: r.color, area: r.area }]} height={90} axes unit={r.unit} labels={timeLabels} cursor={cur} onHover={setCur} />
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
  const [tab, setTab] = useState<'map' | 'timeline' | 'power'>('map')
  const [ftp, setFtp] = useState(260)
  const [review, setReview] = useState<CoachReview | null>(null)
  const [note, setNote] = useState<CoachNote | null>(null)
  const [icuComment, setIcuComment] = useState<string>()
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getSetting('ftp').then((v) => { if (v) setFtp(Number(v)) }).catch(() => {})
    // #273: the coach's verdict + the athlete's own comment come from intervals messages.
    fetchActivityThread(id).then((t) => { setNote(t.coach); setIcuComment(t.comment) }).catch(() => {})
    Promise.all([fetchActivity(id), fetchActivityStreams(id)])
      .then(([act, s]) => {
        setA(act); setStreams(s)
        // …or an in-app review if the coach wrote one here (matched by id, else same-day).
        const day = (act?.start_date_local || '').slice(0, 10)
        if (day) authApi.coachReviews().then((rv) => setReview(rv.find((r) => r.activityId === id) || rv.find((r) => r.date === day) || null)).catch(() => {})
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button><h1>Loading…</h1></div>
  if (!a) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button><h1>Activity not found</h1><p className="meta">It may not be on intervals, or you're not connected.</p></div>

  const track = cleanLatLng(streams.latlng)
  const hasTimeline = TL_ROWS.some((r) => ((streams[r.key] as unknown[] | undefined)?.length || 0) > 1)
  const hasPower = (streams.watts?.filter((v) => v != null).length || 0) >= 5
  const tabs = ([track.length > 1 && 'map', hasTimeline && 'timeline', hasPower && 'power'].filter(Boolean)) as ('map' | 'timeline' | 'power')[]
  const activeTab: 'map' | 'timeline' | 'power' = tabs.includes(tab) ? tab : (tabs[0] || 'map')
  // #273 — intervals-style metric grid (only what this activity actually has).
  const stats: [string, string][] = ([
    a.moving_time ? ['Time', fmtTime(a.moving_time)] : null,
    a.distance ? ['Distance', `${(a.distance / 1000).toFixed(1)} km`] : null,
    a.icu_intensity ? ['Intensity', `${Math.round(a.icu_intensity <= 1.5 ? a.icu_intensity * 100 : a.icu_intensity)}%`] : null,
    a.icu_training_load ? ['Load (TSS)', String(a.icu_training_load)] : null,
    a.icu_weighted_avg_watts ? ['Norm power', `${Math.round(a.icu_weighted_avg_watts)} W`] : null,
    a.icu_average_watts ? ['Avg power', `${Math.round(a.icu_average_watts)} W`] : null,
    a.icu_variability_index ? ['Variability', a.icu_variability_index.toFixed(2)] : null,
    a.icu_eftp ? ['Act. eFTP', `${Math.round(a.icu_eftp)} W`] : null,
    a.average_heartrate ? ['Avg HR', `${Math.round(a.average_heartrate)} bpm`] : null,
    a.max_heartrate ? ['Max HR', `${Math.round(a.max_heartrate)} bpm`] : null,
    a.trimp ? ['TRIMP', String(Math.round(a.trimp))] : null,
    a.average_cadence ? ['Cadence', String(Math.round(a.average_cadence))] : null,
    a.total_elevation_gain ? ['Elevation', `${Math.round(a.total_elevation_gain)} m`] : null,
    a.calories ? ['Calories', String(Math.round(a.calories))] : null,
    a.avg_lr_balance ? ['L/R balance', `${Math.round(100 - a.avg_lr_balance)} · ${Math.round(a.avg_lr_balance)}`] : null,
  ].filter(Boolean)) as [string, string][]
  const device = a.device_name || a.source
  const hasVerdict = !!review || !!note

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{sportOfActivity(a) === 'ride' ? 'Ride' : sportOfActivity(a) === 'run' ? 'Run' : 'Workout'} · {isIndoorActivity(a) ? 'Indoor' : 'Outdoor'}</span>
          <h1 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || 'Activity'}</h1>
        </div>
      </div>

      {!hasVerdict && <ActivityFeedback id={String(a.id)} sport={sportOfActivity(a)} date={(a.start_date_local || '').slice(0, 10)} icuExisting={readIcuFeedback(a)} icuNote={icuComment} />}

      <CoachVerdict review={review} note={note} />
      {a.description && a.description.trim() && (
        <p className="meta" style={{ margin: '2px 2px 10px', whiteSpace: 'normal' }}>{a.description.replace(/\s*(#{1,3})\s*/g, ' ').replace(/\*\*/g, '').trim()}</p>
      )}

      <div className="actstats">{stats.map(([l, v]) => <div key={l} className="actstat"><span>{l}</span><b>{v}</b></div>)}</div>

      {tabs.length > 0 && (
        <div className="act-tabs">
          {tabs.includes('map') && <button className={activeTab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>Map</button>}
          {tabs.includes('timeline') && <button className={activeTab === 'timeline' ? 'on' : ''} onClick={() => setTab('timeline')}>Timeline</button>}
          {tabs.includes('power') && <button className={activeTab === 'power' ? 'on' : ''} onClick={() => setTab('power')}>Power</button>}
        </div>
      )}

      {activeTab === 'map' && <div className="card" style={{ padding: 6 }}><FlybyMap track={track} /></div>}
      {activeTab === 'timeline' && <RideTimeline streams={streams} />}
      {activeTab === 'power' && <RidePower streams={streams} ftp={ftp} />}
      {!tabs.length && <p className="meta">No GPS or sensor data for this activity{isIndoorActivity(a) ? ' (indoor)' : ''}.</p>}

      {hasVerdict && <ActivityFeedback id={String(a.id)} sport={sportOfActivity(a)} date={(a.start_date_local || '').slice(0, 10)} icuExisting={readIcuFeedback(a)} icuNote={icuComment} />}

      <div className="links" style={{ marginTop: 12 }}>
        {a.id && <a className="done-link" href={`https://intervals.icu/activities/${a.id}`} target="_blank" rel="noreferrer">intervals ↗</a>}
        {a.strava_id && <a className="done-link" href={`https://www.strava.com/activities/${a.strava_id}`} target="_blank" rel="noreferrer">Strava ↗</a>}
        {device && <span className="done-link" style={{ opacity: 0.7 }}>from {device}</span>}
      </div>
    </div>
  )
}
