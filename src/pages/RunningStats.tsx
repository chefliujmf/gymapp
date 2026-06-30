import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasModule } from '../modules'
import { vdotFromThresholdPace, paceZones, racePredictions, marathonRealism, estimateVo2max, fmtPace, fmtTime, type RunVolume } from '../running-paces'
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
  const isRunner = hasModule(user?.sports || [], 'running')

  useEffect(() => { if (user?.hasIcuKey && isRunner) authApi.runVolume().then(setRunVol).catch(() => {}) }, [user?.hasIcuKey, isRunner])

  const pace = user?.runThresholdPace ?? null // sec/km
  const vdot = pace ? Math.round(vdotFromThresholdPace(pace)) : (user?.runVdot ?? null)
  const zones = vdot ? paceZones(vdot) : null
  const preds = vdot ? racePredictions(vdot) : null
  const volume: RunVolume | undefined = runVol?.available ? { longestKm: runVol.longestKm || 0, weeklyKm: runVol.weeklyKm || 0 } : undefined
  const marathon = vdot ? marathonRealism(vdot, volume) : null
  const vo2 = estimateVo2max({ vdot })
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
            <MiniCard title="VO₂max" value={vo2 ? vo2.value : null} hint="Running VO₂max ≈ VDOT." />
          </div>
          <p className="meta" style={{ margin: '-4px 2px 10px' }}>Threshold pace <b>{pace ? `${fmtPace(pace)}/km` : '—'}</b> · edit it in <Link to="/profile" style={{ color: 'var(--accent)' }}>Profile</Link> (syncs to intervals).</p>

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
