import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Upload, FileCheck2, X, Link2 } from 'lucide-react'
import { authApi, type ParsedActivity } from '../auth/api'
import { logWorkout } from '../db'
import { fetchGymPlans, type CoachPlan } from '../plan'
import { localISO } from '../date'

// Single smart form (#129): optionally drop a .fit/.gpx/.tcx to prefill everything,
// or just type it in. A route map appears only when the file carried GPS. Saves the
// local Platyplus copy (logWorkout) + fans out to intervals (match-first).
const SPORTS = [
  { v: 'ride', label: '🚴 Ride', disc: 'cycling' },
  { v: 'run', label: '🏃 Run', disc: 'running' },
  { v: 'gym', label: '🏋️ Gym', disc: 'strength' },
  { v: 'swim', label: '🏊 Swim', disc: 'swimming' },
  { v: 'walk', label: '🚶 Walk / Hike', disc: 'walking' },
  { v: 'other', label: '✦ Other', disc: 'other' },
]
const discOf = (v: string) => SPORTS.find((s) => s.v === v)?.disc || 'other'

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new Error('Could not read the file'))
    r.readAsDataURL(file)
  })
}

/** Normalize a [lat,lng][] track into an SVG polyline (no map tiles — keeps it light + independent). */
function RouteMap({ track }: { track: [number, number][] }) {
  const W = 320, H = 150, pad = 10
  const lats = track.map((p) => p[0]), lngs = track.map((p) => p[1])
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const spanLat = maxLat - minLat || 1e-6, spanLng = maxLng - minLng || 1e-6
  // keep aspect-ish: scale by the larger span so the route isn't stretched
  const scale = Math.min((W - 2 * pad) / spanLng, (H - 2 * pad) / spanLat)
  const ox = (W - spanLng * scale) / 2, oy = (H - spanLat * scale) / 2
  const pts = track.map(([la, ln]) => `${(ox + (ln - minLng) * scale).toFixed(1)},${(oy + (maxLat - la) * scale).toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="route-map" role="img" aria-label="Route">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function LogActivity() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const qDate = params.get('date')
  const [sport, setSport] = useState('ride')
  const [date, setDate] = useState(qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : localISO())
  const [time, setTime] = useState('12:00')
  const [durationMin, setDurationMin] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [avgPower, setAvgPower] = useState('')
  const [rpe, setRpe] = useState(0)
  const [notes, setNotes] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileB64, setFileB64] = useState('')
  const [track, setTrack] = useState<[number, number][]>([])
  const [parsing, setParsing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // Plan linking (#131): load the chosen day's planned workouts; offer to link one
  // that matches the sport so saving the import counts toward that plan.
  const [dayPlans, setDayPlans] = useState<CoachPlan[]>([])
  const [linkPlanId, setLinkPlanId] = useState('')
  useEffect(() => {
    let live = true
    fetchGymPlans(date, date).then((ps) => { if (live) setDayPlans(ps) }).catch(() => { if (live) setDayPlans([]) })
    return () => { live = false }
  }, [date])
  const planMatch = dayPlans.find((p) => p.sport === sport)
  // auto-select a matching plan when one appears; clear if the sport no longer matches
  useEffect(() => { setLinkPlanId((cur) => (planMatch ? (cur && dayPlans.some((p) => p.id === cur && p.sport === sport) ? cur : planMatch.id) : '')) }, [planMatch?.id, sport]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(''); setParsing(true)
    try {
      const b64 = await readBase64(file)
      const p: ParsedActivity = await authApi.parseActivityFile(file.name, b64)
      setFileName(file.name); setFileB64(b64)
      if (p.sport && p.sport !== 'other') setSport(p.sport)
      if (p.startIso) { const d = new Date(p.startIso); setDate(localISO(d)); setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`) }
      if (p.durationSec) setDurationMin(String(Math.round(p.durationSec / 60)))
      if (p.distanceM != null) setDistanceKm((p.distanceM / 1000).toFixed(2))
      if (p.avgHr != null) setAvgHr(String(p.avgHr))
      if (p.avgPower != null) setAvgPower(String(p.avgPower))
      setTrack(p.hasGps ? p.track : [])
    } catch (e) { setErr((e as Error).message || 'Could not read that file') }
    finally { setParsing(false) }
  }

  function clearFile() { setFileName(''); setFileB64(''); setTrack([]); if (fileRef.current) fileRef.current.value = '' }

  async function save() {
    setErr('')
    const dur = Math.round(Number(durationMin) || 0)
    if (!dur && !fileB64) { setErr('Add a duration (or import a file).'); return }
    setBusy(true)
    const linked = linkPlanId ? dayPlans.find((p) => p.id === linkPlanId) : undefined
    // a linked plan names the activity (so day+sport+title matching ties them as done)
    const title = (linked?.title || notes.trim().split('\n')[0]).slice(0, 60) || `${SPORTS.find((s) => s.v === sport)?.label.replace(/^\S+\s/, '') || 'Activity'} · ${date}`
    const startIso = new Date(`${date}T${time || '12:00'}:00`).toISOString()
    const distM = distanceKm ? Math.round(Number(distanceKm) * 1000) : undefined
    const hr = avgHr ? Number(avgHr) : undefined
    const pw = avgPower ? Number(avgPower) : undefined
    try {
      // 1) local Platyplus copy (Dexie + server /logs)
      await logWorkout({
        workoutId: fileB64 ? 'imported' : 'manual', title, discipline: discOf(sport), duration: dur, date,
        notes: notes.trim() || undefined, rpe: rpe || undefined, distanceKm: distanceKm ? Number(distanceKm) : undefined,
        avgHr: hr, avgPower: pw, source: fileB64 ? 'file' : 'manual', track: track.length ? track : undefined,
        planId: linked?.id,
      })
      // 2) fan out to intervals (match-first): raw file or a summary TCX
      await authApi.logManualActivity({
        sport, title, date, startIso, durationSec: dur * 60, distanceM: distM, avgHr: hr, avgPower: pw,
        file: fileB64 ? { name: fileName, b64: fileB64 } : undefined,
      }).catch(() => { /* local copy already saved; intervals is best-effort */ })
      navigate('/logs')
    } catch (e) { setErr((e as Error).message || 'Could not save'); setBusy(false) }
  }

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <h1 style={{ margin: 0 }}>Log activity</h1>
      </div>

      {/* optional file import */}
      {!fileName ? (
        <button type="button" className="card import-drop" onClick={() => fileRef.current?.click()} disabled={parsing}>
          <Upload size={20} />
          <div>
            <b>{parsing ? 'Reading file…' : 'Import a file'}</b>
            <div className="meta">.fit · .gpx · .tcx — prefills everything (optional)</div>
          </div>
        </button>
      ) : (
        <div className="card import-done">
          <FileCheck2 size={18} className="ok" />
          <div style={{ flex: 1, minWidth: 0 }}><b>{fileName}</b><div className="meta">{track.length ? `Imported · ${track.length} GPS points` : 'Imported · no GPS'}</div></div>
          <button className="icon-btn" onClick={clearFile} aria-label="Remove file"><X size={16} /></button>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".fit,.gpx,.tcx" hidden onChange={onFile} />

      {track.length > 1 && <div className="card" style={{ padding: 8, marginTop: 10 }}><RouteMap track={track} /></div>}

      <div className="section-title"><h2>Details</h2></div>
      <label className="field-label">Sport</label>
      <select className="search" value={sport} onChange={(e) => setSport(e.target.value)}>
        {SPORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
      </select>

      {planMatch && (
        <button type="button" className={`link-plan${linkPlanId ? ' on' : ''}`} onClick={() => setLinkPlanId(linkPlanId ? '' : planMatch.id)}>
          <span className="link-plan__check">{linkPlanId ? '✓' : ''}</span>
          <Link2 size={16} />
          <span className="link-plan__t"><b>Link to plan: {planMatch.title}</b><span>planned · {date} — saving counts it as done</span></span>
        </button>
      )}

      <div className="form-row">
        <div><label className="field-label">Date</label><input className="search" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="field-label">Start</label><input className="search" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div><label className="field-label">Duration (min)</label><input className="search" type="number" inputMode="numeric" placeholder="45" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} /></div>
        <div><label className="field-label">Distance (km)</label><input className="search" type="number" inputMode="decimal" placeholder="—" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div><label className="field-label">Avg HR</label><input className="search" type="number" inputMode="numeric" placeholder="—" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} /></div>
        <div><label className="field-label">Avg power (W)</label><input className="search" type="number" inputMode="numeric" placeholder="—" value={avgPower} onChange={(e) => setAvgPower(e.target.value)} /></div>
      </div>

      <label className="field-label">How hard? (RPE)</label>
      <div className="rpe-row">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={`rpe-dot${rpe >= n ? ' on' : ''}`} onClick={() => setRpe(n === rpe ? 0 : n)} aria-label={`RPE ${n}`}>{n}</button>
        ))}
      </div>

      <label className="field-label">Notes</label>
      <textarea className="search" rows={2} placeholder="How did it go?" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {err && <p className="auth-err">{err}</p>}
      <button className="btn" style={{ width: '100%', marginTop: 12 }} disabled={busy || parsing} onClick={save}>{busy ? 'Saving…' : 'Save activity'}</button>
    </div>
  )
}
