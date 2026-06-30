import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasModule } from '../modules'
import { vdotFromThresholdPace, paceZones, racePredictions, marathonRealism, fmtPace, fmtTime, type RunVolume } from '../running-paces'
import { runningVo2max, confLabel } from '../vo2max-submax'
import { fetchWellness } from '../intervals'
import { authApi } from '../auth/api'
import { MiniCard } from './Fitness' // reused card shell (no series → just the value)

// #225 — Running per-sport stats: threshold pace · Daniels zones · VDOT · race predictions.
// Pulls the running benchmarks (today shown in Profile too — edit in either, #228).
const ZONES: [keyof ReturnType<typeof paceZones>, string, string][] = [
  ['easy', 'Easy', 'recovery & long runs'],
  ['marathon', 'Marathon', 'steady race pace'],
  ['threshold', 'Threshold', 'comfortably hard (~1 h)'],
  ['interval', 'Interval', 'VO₂max efforts'],
  ['rep', 'Rep', 'speed & economy'],
]

export default function RunningStats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [runVol, setRunVol] = useState<{ available: boolean; longestKm?: number; weeklyKm?: number } | null>(null)
  const [hrRest, setHrRest] = useState<number | null>(null) // #234 HR-ratio input
  const isRunner = hasModule(user?.sports || [], 'running')

  useEffect(() => {
    if (!user?.hasIcuKey || !isRunner) return
    authApi.runVolume().then(setRunVol).catch(() => {})
    const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    fetchWellness(from, to).then((rows) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].restingHR != null) { setHrRest(rows[i].restingHR); break } }).catch(() => {})
  }, [user?.hasIcuKey, isRunner])

  const pace = user?.runThresholdPace ?? null // sec/km
  const vdot = pace ? Math.round(vdotFromThresholdPace(pace)) : (user?.runVdot ?? null)
  const zones = vdot ? paceZones(vdot) : null
  const preds = vdot ? racePredictions(vdot) : null
  const volume: RunVolume | undefined = runVol?.available ? { longestKm: runVol.longestKm || 0, weeklyKm: runVol.weeklyKm || 0 } : undefined
  const marathon = vdot ? marathonRealism(vdot, volume) : null
  // #234 submaximal running VO₂max (manual wins, else VDOT vs HR-ratio higher)
  const vo2 = user?.vo2max ? { value: user.vo2max, source: 'you set it', confidence: 'high' as const } : runningVo2max({ vdot, hrMax: user?.maxHR, hrRest })
  // #237: HR says you're fitter than your (stale) threshold pace → flag it
  const hrRatioMismatch = !!(vo2 && vdot && !user?.vo2max && vo2.value - vdot >= 5)
  const zStr = (k: keyof ReturnType<typeof paceZones>) => { const z = zones![k]; return Array.isArray(z) ? `${fmtPace(z[1])}–${fmtPace(z[0])}` : fmtPace(z) }

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Running</h1><p>Threshold pace · Daniels zones · VDOT · race predictions</p></div>
      </div>
      {!isRunner ? (
        <p className="meta">Add Running in <span style={{ color: 'var(--accent)' }}>Profile</span> to see your pace stats.</p>
      ) : !vdot ? (
        <p className="meta">Set your <Link to="/profile" style={{ color: 'var(--accent)' }}>threshold pace</Link> (the ~1 h race pace you can hold) to unlock Daniels zones, VDOT & race predictions.</p>
      ) : (
        <>
          <div className="fit-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <MiniCard title="Threshold" value={null} hint="Your ~1 h race pace (lactate threshold)." />
            <MiniCard title="VDOT" value={vdot} hint="Daniels' running fitness score (≈ running VO₂max)." />
            <MiniCard title="VO₂max" value={vo2 ? vo2.value : null} hint="Running VO₂max — submaximal estimate from your pace + max/resting HR; no max test needed." />
          </div>
          {vo2 && <p className="meta" style={{ margin: '10px 2px 4px' }}>VO₂max <b>{vo2.value}</b> · <b style={{ color: vo2.confidence === 'high' ? 'var(--accent)' : vo2.confidence === 'medium' ? '#5ec8ff' : '#f0b145' }}>{confLabel(vo2.confidence)}</b> from {vo2.source}. Tap VO₂max in <Link to="/stats" style={{ color: 'var(--accent)' }}>Stats</Link> to enter a measured value.</p>}
          {vo2 && hrRatioMismatch && <p className="meta" style={{ margin: '0 2px 6px', color: '#f0b145' }}>⚠️ Your VDOT ({vdot}) from pace is lower than your HR suggests (~{vo2.value}) — your <b>threshold pace may be set too slow/stale</b>. Update it for accurate zones & predictions.</p>}
          <p className="meta" style={{ margin: '4px 2px 10px' }}>Threshold pace <b>{pace ? `${fmtPace(pace)}/km` : '—'}</b> · edit it in <Link to="/profile" style={{ color: 'var(--accent)' }}>Profile</Link> (syncs to intervals).</p>

          {zones && (
            <>
              <div className="stat-sub">Training pace zones <span className="meta">· target min/km</span></div>
              <div className="zlist">
                {ZONES.map(([k, name, purpose]) => (
                  <div className="zrow" key={k}><span className="zname"><span className="zname-top">{name}</span><span className="zpurpose">{purpose}</span></span><span className="zpace">{zStr(k)}<span className="zunit">/km</span></span></div>
                ))}
              </div>
            </>
          )}

          {preds && marathon && (
            <>
              <div className="stat-sub">Race predictions <span className="meta">· times your VDOT projects</span></div>
              <div className="zlist">
                {preds.filter((p) => p.label !== 'Marathon').map((p) => (
                  <div className="zrow" key={p.label}><span className="zname"><span className="zname-top">{p.label}</span><span className="zpurpose">at {fmtPace(p.pace)}/km</span></span><span className="zpace">{fmtTime(p.sec)}</span></div>
                ))}
                <div className="zrow zrow--mar">
                  <span className="zname"><span className="zname-top">Marathon <span className="range-badge">range</span></span><span className="zpurpose">potential → realistic</span></span>
                  <span className="zpace zpace--mar">{fmtTime(marathon.potentialSec)}–{fmtTime(marathon.realisticSec)}<span className="zsub">{fmtPace(marathon.potentialPace)}–{fmtPace(marathon.realisticPace)}/km</span></span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
