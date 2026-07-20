import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { fetchActivity, fetchActivities, fetchActivityStreams, fetchActivityThread, readIcuFeedback, sportOfActivity, isIndoorActivity, type IcuActivity, type ActivityStreams, type CoachNote } from '../intervals'
import { incompleteFeedback } from '../feedbackGaps'
import { TrendChart, PowerCurveChart, PaceCurveChart, PowerBlocks, ZoneBlocks, minuteTicks } from '../charts'
import { Bike, Dumbbell, Footprints, Waves } from 'lucide-react'
import { fmtPace100 } from '../swimming'
import { fmtPace } from '../running-paces'
import { paceOf, bestPaceCurve, paceZoneSecs, PZONES, PZONE_PCT } from '../run-analysis'
import { useAuth } from '../auth/AuthContext'
import { zoneColor, MiniProfile } from '../ui'
import { plannedLoad } from '../workout-summary'
import { findCoachPlan, getCoachPlan, gymFeedbackKeys, type CoachPlan } from '../plan'
import { getSetting } from '../db'
import { authApi, type CoachReview } from '../auth/api'
import ActivityFeedback from '../ActivityFeedback'
import CoachVerdict from '../CoachVerdict'

// #54 Power tab: mean-max power curve + time-in-zone, computed from the watts stream.
// #355 — densely sampled so the mean-max line reads as ONE continuous curve all the way to 1h.
// (The old set jumped 60→300 with nothing between 1m–5m, so the tail looked like a flat floor and
// the curve appeared to "stop" at 1m.) Durations beyond the activity length are skipped in meanMaxCurve.
const CURVE_DURATIONS = [1, 2, 3, 5, 8, 12, 20, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600, 900, 1200, 1800, 2400, 3000, 3600, 5400, 7200]
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
  // curve insight: 20-min best ≈ threshold read; zones insight: where the time actually went
  const at = (d: number) => { const i = curve.secs.indexOf(d); return i >= 0 ? curve.watts[i] : null }
  const w20 = at(1200) || at(600), peak = curve.watts[0]
  const curveIns = w20 ? `Best 20-min ${w20} W ≈ your threshold read${peak ? ` · 5-s peak ${peak} W` : ''}` : peak ? `5-s peak ${peak} W` : null
  const topZone = zsec.indexOf(Math.max(...zsec))
  const zoneIns = total > 1 ? `Most time in ${ZONES[topZone]} (${Math.round((zsec[topZone] / total) * 100)}%) — ${topZone <= 1 ? 'a genuinely easy/aerobic session' : topZone <= 2 ? 'solid endurance-to-tempo load' : 'real intensity today'}` : null
  return (
    <div>
      <div className="tl-card">
        <div className="tl-clabel">POWER CURVE · best avg by duration (W)</div>
        <PowerCurveChart secs={curve.secs} watts={curve.watts} height={170} />
        {curveIns && <div className="act-ins"><span className="tag">💡</span>{curveIns}</div>}
      </div>
      <div className="tl-card">
        <div className="tl-clabel">TIME IN ZONE · FTP {ftp} W</div>
        <div className="zbar">{ZONES.map((_, i) => zsec[i] > 0 && <div key={i} style={{ width: `${(zsec[i] / total) * 100}%`, background: zoneColor(ZONE_PCT[i]) }} title={`${ZONES[i]} ${mmss(zsec[i])}`} />)}</div>
        <div className="zlist">{ZONES.map((z, i) => zsec[i] > 0 && (
          <div key={i} className="zrow"><span className="zdot" style={{ background: zoneColor(ZONE_PCT[i]) }} />{z}<b>{mmss(zsec[i])}</b><span className="meta">{Math.round((zsec[i] / total) * 100)}%</span></div>
        ))}</div>
        {zoneIns && <div className="act-ins"><span className="tag">💡</span>{zoneIns}</div>}
      </div>
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

// #54/#286: stacked power/HR/altitude/cadence charts sharing ONE scrubber, each to the chart
// standard — Y axis (dense ticks), round-minute TIME x-axis + gridlines, avg·max in the header,
// and a COMPUTED coach insight line under each (the "insight per section" JM asked for).
function RideTimeline({ streams, a }: { streams: ActivityStreams; a: IcuActivity }) {
  const [cur, setCur] = useState<number | null>(null)
  const rows = TL_ROWS.filter((r) => ((streams[r.key] as unknown[] | undefined)?.length || 0) > 1)
  if (!rows.length) return <p className="meta">No power / HR / altitude data for this activity.</p>
  const data: Record<string, (number | null)[]> = {}
  for (const r of rows) data[r.key] = ds(streams[r.key] as (number | null)[])
  const timeArr = streams.time && streams.time.length > 1 ? ds(streams.time as number[]) : null
  const totalSec = timeArr ? Number(timeArr[timeArr.length - 1]) || 0 : 0
  const xTicks = totalSec > 0 ? minuteTicks(totalSec) : undefined
  const timeLabels = timeArr ? timeArr.map((v) => (v == null ? '' : fmtElapsed(v as number))) : undefined
  const stat = (key: string) => { const v = data[key].filter((x): x is number => x != null); if (!v.length) return ''; const avg = Math.round(v.reduce((a2, b) => a2 + b, 0) / v.length); const mx = Math.round(Math.max(...v)); if (key === 'watts') { const np = a.icu_weighted_avg_watts ? Math.round(a.icu_weighted_avg_watts) : null; return `${np ? ` · NP ${np}` : ''} · avg ${avg} · max ${mx}` } return ` · avg ${avg} · max ${mx}` } // #567 — show NP + avg together (was avg only; NP was hidden in the insight)
  const avg = (key: string) => { const v = data[key].filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((a2, b) => a2 + b, 0) / v.length) : 0 }
  const insight = (key: string): string | null => {
    if (key === 'watts') { const vi = a.icu_variability_index; const np = a.icu_weighted_avg_watts ? Math.round(a.icu_weighted_avg_watts) : null; if (vi) return `NP ${np ?? avg('watts')} W · VI ${vi.toFixed(2)} — ${vi >= 1.2 ? 'stochastic — lots of surges and coasts' : vi >= 1.08 ? 'somewhat variable — surges and easing' : 'steady, even effort'}`; return `Avg ${avg('watts')} W over the ride` }
    if (key === 'heartrate') { const mx = a.max_heartrate ? Math.round(a.max_heartrate) : Math.max(...data.heartrate.filter((x): x is number => x != null)); return `Avg ${avg('heartrate')} bpm, peaked ${mx} — effort held ${avg('heartrate') / mx >= 0.85 ? 'high' : 'moderate'} for the session` }
    if (key === 'altitude') { const g = a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null; return g ? `${g} m climbed — ${g > 400 ? 'punchy up/down, hard to hold clean blocks' : g > 150 ? 'rolling terrain' : 'mostly flat'}` : null }
    if (key === 'cadence') return `Avg ${avg('cadence')} rpm${avg('cadence') < 85 ? ' — grindy, watch the knees on climbs' : ''}`
    return null
  }
  return (
    <div>
      {rows.map((r) => {
        const ins = insight(r.key)
        return (
          <div key={r.key} className="tl-card">
            <div className="tl-clabel">{r.label.toUpperCase()}{r.unit}{stat(r.key)}</div>
            <TrendChart series={[{ label: r.label, data: data[r.key], color: r.color, area: r.area }]} height={150} axes unit={r.unit} labels={timeLabels} xTicks={xTicks} cursor={cur} onHover={setCur} />
            {ins && <div className="act-ins"><span className="tag">💡</span>{ins}</div>}
          </div>
        )
      })}
      <p className="meta" style={{ textAlign: 'center', fontSize: 11 }}>drag across to scrub — all charts move together</p>
    </div>
  )
}

// ── #333 RUN analytics — a run shows PACE, never watts (pure maths in run-analysis.ts) ────
function RunPace({ streams, thrPace }: { streams: ActivityStreams; thrPace: number | null }) {
  const vel = streams.velocity_smooth || []
  if (vel.filter((v) => v != null && Number(v) > 0.4).length < 5) return <p className="meta">No pace/GPS data for this run.</p>
  const curve = bestPaceCurve(vel)
  const at = (d: number) => { const i = curve.secs.indexOf(d); return i >= 0 ? curve.pace[i] : null }
  const best5 = at(300) || at(600), sprint = curve.pace.length ? curve.pace[0] : null
  const curveIns = best5 ? `Best 5-min ${fmtPace(best5)}/km${sprint ? ` · quickest ${fmtPace(sprint)}/km` : ''}` : null
  const zsec = thrPace ? paceZoneSecs(vel, thrPace) : null
  const total = zsec ? zsec.reduce((a, b) => a + b, 0) || 1 : 1
  const topZone = zsec ? zsec.indexOf(Math.max(...zsec)) : -1
  const zoneIns = zsec && total > 1 ? `Most time in ${PZONES[topZone]} (${Math.round((zsec[topZone] / total) * 100)}%) — ${topZone <= 1 ? 'a genuinely easy aerobic run' : topZone <= 2 ? 'solid endurance/steady work' : 'real intensity today'}` : null
  return (
    <div>
      <div className="tl-card">
        <div className="tl-clabel">PACE CURVE · best avg pace by duration (min/km)</div>
        <PaceCurveChart secs={curve.secs} pace={curve.pace} height={170} />
        {curveIns && <div className="act-ins"><span className="tag">💡</span>{curveIns}</div>}
      </div>
      {zsec ? (
        <div className="tl-card">
          <div className="tl-clabel">TIME IN ZONE · threshold {fmtPace(thrPace!)}/km</div>
          <div className="zbar">{PZONES.map((_, i) => zsec[i] > 0 && <div key={i} style={{ width: `${(zsec[i] / total) * 100}%`, background: zoneColor(PZONE_PCT[i]) }} title={`${PZONES[i]} ${mmss(zsec[i])}`} />)}</div>
          <div className="zlist">{PZONES.map((z, i) => zsec[i] > 0 && (
            <div key={i} className="zrow"><span className="zdot" style={{ background: zoneColor(PZONE_PCT[i]) }} />{z}<b>{mmss(zsec[i])}</b><span className="meta">{Math.round((zsec[i] / total) * 100)}%</span></div>
          ))}</div>
          {zoneIns && <div className="act-ins"><span className="tag">💡</span>{zoneIns}</div>}
        </div>
      ) : (
        <div className="tl-card"><div className="act-ins"><span className="tag">⚙</span>Set your <Link to="/profile?onboard=1#ob-numbers" style={{ color: 'var(--accent)' }}>threshold pace</Link> to see time-in-zone (Easy / Marathon / Threshold / Interval).</div></div>
      )}
    </div>
  )
}

// Run timeline: PACE (from speed) + HR + altitude + cadence sharing one scrubber. No watts.
const RUN_TL_ROWS = [
  { key: 'pace', label: 'Pace', unit: '/km', color: '#34e07d', area: true },
  { key: 'heartrate', label: 'HR', unit: ' bpm', color: '#ff5d6c', area: false },
  { key: 'altitude', label: 'Altitude', unit: ' m', color: '#7a8699', area: true },
  { key: 'cadence', label: 'Cadence', unit: ' spm', color: '#4aa3ff', area: false },
] as const
function RunTimeline({ streams, a }: { streams: ActivityStreams; a: IcuActivity }) {
  const [cur, setCur] = useState<number | null>(null)
  const paceArr = (streams.velocity_smooth || []).map(paceOf)
  const hasPace = paceArr.filter((v) => v != null).length > 1
  const src: Record<string, (number | null)[] | undefined> = { pace: hasPace ? paceArr : undefined, heartrate: streams.heartrate, altitude: streams.altitude, cadence: streams.cadence }
  const rows = RUN_TL_ROWS.filter((r) => ((src[r.key])?.length || 0) > 1)
  if (!rows.length) return <p className="meta">No pace / HR / altitude data for this run.</p>
  const data: Record<string, (number | null)[]> = {}
  for (const r of rows) data[r.key] = ds(src[r.key])
  const timeArr = streams.time && streams.time.length > 1 ? ds(streams.time as number[]) : null
  const totalSec = timeArr ? Number(timeArr[timeArr.length - 1]) || 0 : 0
  const xTicks = totalSec > 0 ? minuteTicks(totalSec) : undefined
  const timeLabels = timeArr ? timeArr.map((v) => (v == null ? '' : fmtElapsed(v as number))) : undefined
  const nums = (key: string) => data[key].filter((x): x is number => x != null)
  const stat = (key: string) => { const v = nums(key); if (!v.length) return ''; if (key === 'pace') { const avg = v.reduce((a2, b) => a2 + b, 0) / v.length; return ` · avg ${fmtPace(avg)} · best ${fmtPace(Math.min(...v))}` } const avg = Math.round(v.reduce((a2, b) => a2 + b, 0) / v.length); return ` · avg ${avg} · max ${Math.round(Math.max(...v))}` }
  const avg = (key: string) => { const v = nums(key); return v.length ? v.reduce((a2, b) => a2 + b, 0) / v.length : 0 }
  const insight = (key: string): string | null => {
    if (key === 'pace') { const v = nums('pace'); if (!v.length) return null; const drift = v.length > 20 ? (v.slice(-Math.floor(v.length / 3)).reduce((a2, b) => a2 + b, 0) / Math.floor(v.length / 3)) - (v.slice(0, Math.floor(v.length / 3)).reduce((a2, b) => a2 + b, 0) / Math.floor(v.length / 3)) : 0; return `Avg ${fmtPace(avg('pace'))}/km — ${Math.abs(drift) < 6 ? 'evenly paced, well controlled' : drift > 0 ? `faded ~${Math.round(drift)}s/km late (fuel/effort)` : `negative split — ${Math.round(-drift)}s/km quicker late`}` }
    if (key === 'heartrate') { const mx = a.max_heartrate ? Math.round(a.max_heartrate) : Math.max(...nums('heartrate')); return `Avg ${Math.round(avg('heartrate'))} bpm, peaked ${mx}` }
    if (key === 'altitude') { const g = a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null; return g ? `${g} m climbed — ${g > 200 ? 'hilly, pace reads slower for the effort' : g > 60 ? 'rolling' : 'mostly flat'}` : null }
    if (key === 'cadence') { const c = Math.round(avg('cadence')); return `Avg ${c} spm${c > 0 && c < 165 ? ' — a touch low; quick, light steps ease impact' : ''}` }
    return null
  }
  return (
    <div>
      {rows.map((r) => {
        const ins = insight(r.key)
        return (
          <div key={r.key} className="tl-card">
            <div className="tl-clabel">{r.label.toUpperCase()}{r.unit}{stat(r.key)}</div>
            <TrendChart series={[{ label: r.label, data: data[r.key], color: r.color, area: r.area }]} height={150} axes unit={r.unit} fmt={r.key === 'pace' ? (v) => `${fmtPace(v)}/km` : undefined} invert={r.key === 'pace'} labels={timeLabels} xTicks={xTicks} cursor={cur} onHover={setCur} />
            {ins && <div className="act-ins"><span className="tag">💡</span>{ins}</div>}
          </div>
        )
      })}
      <p className="meta" style={{ textAlign: 'center', fontSize: 11 }}>drag across to scrub — all charts move together</p>
    </div>
  )
}

// Post-workout activity detail (#51 map + flyby, #54 analytics).
export default function ActivityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fromReview = (useLocation().state as { from?: string } | null)?.from === '/review' // #442b — return to the review list after Save
  // #473 — after saving, go BACK to the review list to keep knocking them out; but if that was the LAST one,
  // go to Today (don't dump the user on an empty "all caught up" screen). We re-check the remaining gaps,
  // excluding the one just saved (its feedback may not have synced back to intervals yet).
  const afterSave = fromReview ? async () => {
    try {
      const now = new Date(), from = new Date(now); from.setDate(from.getDate() - 45)
      const iso = (d: Date) => d.toISOString().slice(0, 10)
      const acts = await fetchActivities(iso(from), iso(now))
      const remaining = incompleteFeedback(acts).filter((g) => String(g.act.id) !== String(id))
      navigate(remaining.length ? '/review' : '/')
    } catch { navigate('/review') }
  } : undefined
  const { user, refresh } = useAuth()
  const [picking, setPicking] = useState(false) // #564 — plan picker sheet open
  const [linkBusy, setLinkBusy] = useState(false)
  const [a, setA] = useState<IcuActivity | null>(null)
  const [streams, setStreams] = useState<ActivityStreams>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'timeline' | 'power'>('timeline')
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

  const isRun = sportOfActivity(a) === 'run' // #333 — a run shows PACE, never watts
  const isSwim = sportOfActivity(a) === 'swim' // #swim-tri — a swim shows pace /100 + SWOLF, never watts
  // #575 — run/swim thumbnail = zone-blocks from the SPEED stream (same concept as a ride's PowerBlocks). Anchor =
  // threshold SPEED (m/s): run 1000/thresholdPace, swim 100/CSS. Higher speed = harder = a taller, warmer block.
  const cssPace100 = user?.sportSettings?.swimming?.thresholdPace ?? null
  const speedAnchor = isSwim ? (cssPace100 ? 100 / cssPace100 : undefined) : (isRun && (user?.sportSettings?.running?.thresholdPace ?? user?.runThresholdPace) ? 1000 / (user?.sportSettings?.running?.thresholdPace ?? user!.runThresholdPace!) : undefined)
  const velN = streams.velocity_smooth?.filter((v) => v != null && Number(v) > 0.3).length || 0
  const thrPace = user?.sportSettings?.running?.thresholdPace ?? user?.runThresholdPace ?? null // sec/km
  // #293 — link back to the coach plan this activity fulfilled (match day + sport).
  // #564 — a MANUAL link/unlink overrides the day+sport auto-match. activityLinks[id] = planId (linked) | null (unlinked).
  const dISOplan = (a.start_date_local || '').slice(0, 10)
  const linkedId = user?.activityLinks?.[String(a.id)] // string | null | undefined
  const plan = linkedId === null ? undefined : linkedId ? getCoachPlan(linkedId) : findCoachPlan(dISOplan, sportOfActivity(a))
  const isManualLink = !!linkedId // an explicit link the user chose (vs the auto-match)
  // candidate plans for the picker: same sport, within ±4 days, from the loaded coach plans.
  const nearbyPlans = (() => {
    try {
      const all = JSON.parse(sessionStorage.getItem('coachPlans') || '[]') as CoachPlan[]
      const day = new Date(dISOplan + 'T00:00').getTime()
      return all.filter((p) => p.sport === sportOfActivity(a) && Math.abs(new Date(p.date + 'T00:00').getTime() - day) <= 4 * 86400000)
        .sort((x, y) => Math.abs(new Date(x.date + 'T00:00').getTime() - day) - Math.abs(new Date(y.date + 'T00:00').getTime() - day))
    } catch { return [] as CoachPlan[] }
  })()
  const setLink = async (planId: string | null, icuEventId?: string | null) => {
    if (linkBusy) return
    setLinkBusy(true)
    try { await authApi.linkActivity({ activityId: String(a.id), planId, icuEventId }); await refresh() } catch { /* keep UI */ } finally { setLinkBusy(false); setPicking(false) }
  }
  const hasTimeline = isRun
    ? ((streams.velocity_smooth?.filter((v) => v != null).length || 0) > 1 || (streams.heartrate?.filter((v) => v != null).length || 0) > 1)
    : TL_ROWS.some((r) => ((streams[r.key] as unknown[] | undefined)?.length || 0) > 1)
  // the 3rd (analysis) tab: PACE for runs, POWER for rides
  const hasAnalysis = isRun ? (streams.velocity_smooth?.filter((v) => v != null && Number(v) > 0.4).length || 0) >= 5 : (streams.watts?.filter((v) => v != null).length || 0) >= 5
  // #566 — map/flyby tab removed (JM). Tabs = timeline + analysis only.
  const tabs = ([hasTimeline && 'timeline', hasAnalysis && 'power'].filter(Boolean)) as ('timeline' | 'power')[]
  const activeTab: 'timeline' | 'power' = tabs.includes(tab) ? tab : (tabs[0] || 'timeline')
  const avgPace = isRun && a.moving_time && a.distance ? a.moving_time / (a.distance / 1000) : null // sec/km
  const avgPace100 = isSwim && a.moving_time && a.distance ? a.moving_time / (a.distance / 100) : null // sec/100 m
  const swolf = (a as unknown as { average_swolf?: number }).average_swolf
  const poolLen = (a as unknown as { pool_length?: number }).pool_length
  // #273 — intervals-style metric grid (only what this activity actually has). SWIM = pace/100; RUN = pace/km; RIDE = power.
  const stats: [string, string][] = (isSwim
    ? [
      a.moving_time ? ['Time', fmtTime(a.moving_time)] : null,
      a.distance ? ['Distance', `${Math.round(a.distance)} m`] : null,
      avgPace100 ? ['Avg pace', `${fmtPace100(avgPace100)}/100`] : null,
      a.icu_training_load ? ['Load (TSS)', String(a.icu_training_load)] : null,
      swolf ? ['SWOLF', String(Math.round(swolf))] : null,
      poolLen ? ['Pool', `${Math.round(poolLen)} m`] : null,
      a.average_heartrate ? ['Avg HR', `${Math.round(a.average_heartrate)} bpm`] : null,
      a.max_heartrate ? ['Max HR', `${Math.round(a.max_heartrate)} bpm`] : null,
      a.average_cadence ? ['Stroke rate', `${Math.round(a.average_cadence)} spm`] : null,
      a.calories ? ['Calories', String(Math.round(a.calories))] : null,
    ]
    : isRun
    ? [
      a.moving_time ? ['Time', fmtTime(a.moving_time)] : null,
      a.distance ? ['Distance', `${(a.distance / 1000).toFixed(2)} km`] : null,
      avgPace ? ['Avg pace', `${fmtPace(avgPace)}/km`] : null,
      a.icu_training_load ? ['Load (TSS)', String(a.icu_training_load)] : null,
      a.average_heartrate ? ['Avg HR', `${Math.round(a.average_heartrate)} bpm`] : null,
      a.max_heartrate ? ['Max HR', `${Math.round(a.max_heartrate)} bpm`] : null,
      a.icu_intensity ? ['Intensity', `${Math.round(a.icu_intensity <= 1.5 ? a.icu_intensity * 100 : a.icu_intensity)}%`] : null,
      a.trimp ? ['TRIMP', String(Math.round(a.trimp))] : null,
      a.average_cadence ? ['Cadence', `${Math.round(a.average_cadence)} spm`] : null,
      a.total_elevation_gain ? ['Elevation', `${Math.round(a.total_elevation_gain)} m`] : null,
      a.calories ? ['Calories', String(Math.round(a.calories))] : null,
    ]
    : [
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
    ]).filter(Boolean) as [string, string][]
  const device = a.device_name || a.source
  // #286 hero + chips: 4 headline stats big, the rest as compact chips (JM pick B)
  const HERO = isSwim ? ['Distance', 'Avg pace', 'Load (TSS)', 'SWOLF'] : isRun ? ['Distance', 'Avg pace', 'Load (TSS)', 'Avg HR'] : ['Load (TSS)', 'Norm power', 'Intensity', 'Avg HR']
  const hero: [string, string][] = stats.filter(([l]) => HERO.includes(l)).slice(0, 4)
  const heroSet = new Set(hero.map((h) => h[0]))
  for (const s of stats) { if (hero.length >= 4) break; if (!heroSet.has(s[0])) { hero.push(s); heroSet.add(s[0]) } }
  const chips = stats.filter(([l]) => !heroSet.has(l))

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        {/* EVERY activity gets a thumbnail (JM audit): rides with power → PowerBlocks; else a sport-icon thumb
            (runs, gym, power-less rides) so the header is never blank — matches the calendar/day cards. */}
        {!isRun && !isSwim && (streams.watts?.filter((v) => v != null).length || 0) >= 9
          ? <div className="act-thumb"><PowerBlocks watts={streams.watts} ftp={ftp} /></div>
          : (isRun || isSwim) && velN >= 9
          ? <div className="act-thumb"><ZoneBlocks values={streams.velocity_smooth} anchor={speedAnchor} /></div>
          : <div className={'act-thumb thumb--' + sportOfActivity(a)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sportOfActivity(a) === 'ride' ? <Bike strokeWidth={1.75} /> : sportOfActivity(a) === 'gym' ? <Dumbbell strokeWidth={1.75} /> : sportOfActivity(a) === 'swim' ? <Waves strokeWidth={1.75} /> : <Footprints strokeWidth={1.75} />}</div>}
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{sportOfActivity(a) === 'ride' ? 'Ride' : sportOfActivity(a) === 'run' ? 'Run' : sportOfActivity(a) === 'swim' ? 'Swim' : 'Workout'} · {isIndoorActivity(a) ? 'Indoor' : 'Outdoor'}{a.start_date_local ? ` · ${new Date(a.start_date_local).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}</span>
          <h1 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || 'Activity'}</h1>
        </div>
      </div>

      {/* #503/#JM 2026-07-15 — MERGED TOP: coach verdict → your feedback → source links, ONE place (was: coach duplicated
          top+bottom, feedback + links buried at the bottom). reviewShownAbove drops the duplicate review + "See all" link. */}
      <CoachVerdict review={review} note={note} />
      {(() => {
        const dISO = (a.start_date_local || '').slice(0, 10)
        // gym feedback uses the shared resolver (plan id / activity id / date) so it's the SAME entry as the gym
        // summary + done screen; ride/run keep the activity id. (#feedback-key-audit)
        const fk = sportOfActivity(a) === 'gym' ? gymFeedbackKeys({ date: dISO, planId: plan?.id, activityId: a.id }) : { id: String(a.id), altIds: [] as string[] }
        return <ActivityFeedback id={fk.id} altIds={fk.altIds} sport={sportOfActivity(a)} date={dISO} icuExisting={readIcuFeedback(a)} icuNote={icuComment} onSaved={afterSave} reviewShownAbove={!!review} />
      })()}
      <div className="links" style={{ margin: '6px 2px 12px' }}>
        {plan && sportOfActivity(a) === 'gym' && <Link className="done-link done-link--map" to={`/coach/${plan.id}`}>📋 Planned workout →</Link>}
        {a.id && <a className="done-link" href={`https://intervals.icu/activities/${a.id}`} target="_blank" rel="noreferrer">intervals ↗</a>}
        {a.strava_id && <a className="done-link" href={`https://www.strava.com/activities/${a.strava_id}`} target="_blank" rel="noreferrer">Strava ↗</a>}
        {device && <span className="done-link" style={{ opacity: 0.7 }}>from {device}</span>}
      </div>
      {a.description && a.description.trim() && (
        <p className="meta" style={{ margin: '2px 2px 10px', whiteSpace: 'normal' }}>{a.description.replace(/\s*(#{1,3})\s*/g, ' ').replace(/\*\*/g, '').trim()}</p>
      )}

      <div className="act-hero">{hero.map(([l, v]) => <div key={l} className="ht"><b>{v}</b><span>{l}</span></div>)}</div>
      {chips.length > 0 && <div className="act-chips">{chips.map(([l, v]) => <span key={l} className="act-chip"><b>{v}</b><span>{l}</span></span>)}</div>}

      {/* Planned-workout link preview (ride/run) — a slim chip-bar under the stats: profile + title + key set,
          tapping opens the plan AS PLANNED (?planned=1). #564 — MANUALLY link (＋) or unlink (✕): a manual link
          overrides the day+sport auto-match and mirrors the pairing to intervals. Gym keeps its own link. */}
      {sportOfActivity(a) !== 'gym' && (() => {
        const pm = plan && plan.sport === sportOfActivity(a) && plan.segments?.length ? plan : null
        if (pm) {
          const secs = pm.segments!.reduce((s, x) => s + (x.duration || 0), 0)
          const mins = Math.round(secs / 60)
          const timeStr = mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : `${mins} min`
          const load = plannedLoad(pm.segments!, ftp)
          const intens = load ? (load.if < 0.75 ? (isRun ? 'Easy' : 'Z2 endurance') : load.if < 0.88 ? 'Tempo / SS' : 'Threshold+') : ''
          const sub = [intens, timeStr, load ? `~${load.tss} TSS` : null, isManualLink ? 'linked' : 'planned'].filter(Boolean).join(' · ')
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
              <Link to={`/coach/${pm.id}?planned=1`} className="card" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', textDecoration: 'none', color: 'var(--text)' }}>
                <span style={{ fontSize: 15, flex: 'none' }}>📋</span>
                <div style={{ width: 46, height: 28, flex: 'none' }}><MiniProfile segs={pm.segments!} /></div>
                <div style={{ minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{pm.title}</b> <span className="meta" style={{ fontSize: 11.5 }}>· {sub}</span></div>
                <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 800, fontSize: 17, flex: 'none' }}>›</span>
              </Link>
              <button className="icon-btn" title="Unlink this planned workout" aria-label="Unlink planned workout" disabled={linkBusy} onClick={() => setLink(null)} style={{ flex: 'none' }}>✕</button>
            </div>
          )
        }
        // no plan attached (auto-match empty, or explicitly unlinked) → offer to link one
        return (
          <button disabled={linkBusy} onClick={() => setPicking(true)} style={{ width: '100%', marginTop: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, border: '1.5px dashed #34405a', background: '#12161c', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>＋ Link a planned workout</button>
        )
      })()}

      {/* #564 — the plan picker: nearby same-sport plans (±4 days), tap to link. */}
      {picking && (
        <div className="sheet-overlay" onClick={() => setPicking(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><strong>Link a planned {sportOfActivity(a) === 'run' ? 'run' : 'ride'}</strong><button className="btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setPicking(false)}>Cancel</button></div>
            {nearbyPlans.length === 0 ? <p className="meta" style={{ padding: '4px 2px' }}>No planned {sportOfActivity(a) === 'run' ? 'runs' : 'rides'} within a few days of this activity.</p> : (
              <div className="stack" style={{ gap: 8 }}>
                {nearbyPlans.map((p) => {
                  const dd = Math.round((new Date(p.date + 'T00:00').getTime() - new Date(dISOplan + 'T00:00').getTime()) / 86400000)
                  const when = dd === 0 ? 'same day' : dd > 0 ? `+${dd}d` : `${dd}d`
                  return (
                    <button key={p.id} className="card" disabled={linkBusy} onClick={() => setLink(p.id, p.icuEventId)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', textAlign: 'left' }}>
                      {p.segments?.length ? <div style={{ width: 40, height: 26, flex: 'none' }}><MiniProfile segs={p.segments} /></div> : <span style={{ fontSize: 16, flex: 'none' }}>📋</span>}
                      <div style={{ minWidth: 0, flex: 1 }}><b style={{ fontSize: 13 }}>{p.title}</b><div className="meta" style={{ fontSize: 11.5 }}>{new Date(p.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div></div>
                      <span className="meta" style={{ fontSize: 11, flex: 'none' }}>{when}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tabs.length > 0 && (
        <div className="act-tabs">
          {tabs.includes('timeline') && <button className={activeTab === 'timeline' ? 'on' : ''} onClick={() => setTab('timeline')}>Timeline</button>}
          {tabs.includes('power') && <button className={activeTab === 'power' ? 'on' : ''} onClick={() => setTab('power')}>{isRun ? 'Pace' : 'Power'}</button>}
        </div>
      )}

      {activeTab === 'timeline' && (isRun ? <RunTimeline streams={streams} a={a} /> : <RideTimeline streams={streams} a={a} />)}
      {activeTab === 'power' && (isRun ? <RunPace streams={streams} thrPace={thrPace} /> : <RidePower streams={streams} ftp={ftp} />)}
      {!tabs.length && <p className="meta">No GPS or sensor data for this activity{isIndoorActivity(a) ? ' (indoor)' : ''}.</p>}
    </div>
  )
}
