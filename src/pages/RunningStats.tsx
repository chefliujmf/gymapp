import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasModule } from '../modules'
import { vdotFromThresholdPace, paceZones, racePredictions, marathonRealism, fmtPace, fmtTime, parsePace, type RunVolume } from '../running-paces'
import { runningVo2max } from '../vo2max-submax'
import { fetchWellness, fetchPaceCurve, bestPaceAtDist, type PaceCurve } from '../intervals'
import { setSetting } from '../db'
import { authApi } from '../auth/api'
import { TrendChart, PaceCurveChart, InfoDot } from '../charts'
import { BenchmarksCard } from '../Benchmarks'

// #275 — editable threshold-pace cell (tap to edit here, syncs to intervals like Profile does).
function ThresholdCell({ pace, onSave }: { pace: number | null; onSave: (sec: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [txt, setTxt] = useState('')
  const commit = () => { onSave(txt.trim() ? parsePace(txt.trim()) : null); setEditing(false) }
  return (
    <div className="fit-mini" style={{ cursor: 'pointer' }} onClick={() => { if (!editing) { setTxt(pace ? fmtPace(pace) : ''); setEditing(true) } }}>
      <div className="fit-mini__head">
        <span>Threshold <InfoDot text="Your ~1 h race pace (lactate threshold). Tap to edit — syncs to intervals." /></span>
        {editing
          ? <input autoFocus value={txt} placeholder="m:ss" inputMode="numeric" onChange={(e) => setTxt(e.target.value)} onBlur={commit} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') commit() }} style={{ width: 60, textAlign: 'right', background: 'transparent', border: 0, borderBottom: '1px solid var(--accent)', color: 'var(--accent)', fontWeight: 800, fontSize: 18 }} />
          : <b>{pace ? fmtPace(pace) : '—'}</b>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{pace ? '/km · tap to edit' : 'tap to set'}</div>
    </div>
  )
}

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
  const { user, refresh } = useAuth()
  const [runVol, setRunVol] = useState<{ available: boolean; longestKm?: number; weeklyKm?: number } | null>(null)
  const [hrRest, setHrRest] = useState<number | null>(null) // #234 HR-ratio input
  const [paceTrend, setPaceTrend] = useState<(number | null)[] | null>(null) // #230 per-week avg pace
  const [pc, setPc] = useState<PaceCurve | null>(null) // #396 mean-max pace curve
  const isRunner = hasModule(user?.sports || [], 'running')

  useEffect(() => {
    if (!user?.hasIcuKey || !isRunner) return
    authApi.runVolume().then(setRunVol).catch(() => {})
    authApi.runPaceTrend().then((r) => setPaceTrend(r.available && r.paces ? r.paces : [])).catch(() => {})
    fetchPaceCurve(90).then(setPc).catch(() => setPc(null)) // #396
    const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    fetchWellness(from, to).then((rows) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].restingHR != null) { setHrRest(rows[i].restingHR); break } }).catch(() => {})
  }, [user?.hasIcuKey, isRunner])

  const pace = user?.runThresholdPace ?? null // sec/km
  // #275: save the threshold pace from here (mirrors Profile.saveRunPace → syncs to intervals).
  const saveRunPace = (sec: number | null) => {
    const c = sec && sec > 0 ? sec : null
    authApi.saveSportStat({ group: 'running', thresholdPace: c, runVdot: c ? Math.round(vdotFromThresholdPace(c)) : null }).then(() => refresh()).catch(() => {})
    setSetting('runThresholdPace', c ? String(c) : '')
  }
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
          {/* #385 — same polished benchmark cards as Global, filtered to running (Threshold pace · VO₂max · Max HR). */}
          <BenchmarksCard only={['thresholdPace', 'vo2max', 'maxHr']} />
          {/* Quick inline threshold-pace editor (the benchmark card shows current + confidence; this is the fast tap-to-edit that drives zones & predictions below). */}
          <div className="fit-grid" style={{ gridTemplateColumns: '1fr' }}>
            <ThresholdCell pace={pace} onSave={saveRunPace} />
          </div>
          {vo2 && hrRatioMismatch && <p className="meta" style={{ margin: '10px 2px 6px', color: '#f0b145' }}>⚠️ Your VDOT ({vdot}) from pace is lower than your HR suggests (~{vo2.value}) — your <b>threshold pace may be set too slow/stale</b>. Update it for accurate zones & predictions.</p>}

          {/* #396 — mean-max PACE curve (running's power curve): fastest pace held for each duration, from intervals. */}
          {pc && pc.secs.length >= 2 && (
            <div className="card" style={{ padding: '12px 14px', marginTop: 12 }}>
              <div className="fit-legend"><span style={{ color: '#ffb13d' }}>● Pace curve<InfoDot text="Your fastest pace held for each duration — short bursts on the left (seconds), long runs on the right (up to ~minutes). Push a line UP (faster) = you got quicker at that effort. Read live from intervals.icu." /></span></div>
              <PaceCurveChart secs={pc.secs} pace={pc.pace} color="#ffb13d" />
              <div className="be-row">
                {([[1000, '1 km'], [5000, '5 km'], [10000, '10 km']] as [number, string][]).map(([m, label]) => {
                  const p = bestPaceAtDist(pc, m)
                  return <div key={label} className="be"><span>{label}</span><b>{p ? fmtPace(p) : '—'}</b>{p ? <em>/km</em> : null}</div>
                })}
              </div>
            </div>
          )}

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

          {paceTrend && paceTrend.some((p) => p != null) && (() => {
            const v = paceTrend.filter((x): x is number => x != null)
            const first = v[0], lastV = v[v.length - 1], diff = first - lastV // + = faster (pace dropped)
            const insight = Math.abs(diff) < 3 ? '➡️ Pace is steady over the last 8 weeks.' : diff > 0 ? `📈 ${Math.round(diff)}s/km faster than 8 weeks ago — getting quicker.` : `📉 ${Math.round(-diff)}s/km slower than 8 weeks ago.`
            return (
              <>
                <div className="stat-sub">Pace trend <span className="meta">· avg min/km per week</span></div>
                <div className="card chart-card" style={{ padding: '12px 14px' }}>
                  <TrendChart series={[{ label: 'pace', data: paceTrend, color: '#ffb13d', area: true }]} height={110} axes fmt={fmtPace} labels={['7w', '6w', '5w', '4w', '3w', '2w', '1w', 'now']} />
                  <p className="fit-insight">{insight}</p>
                </div>
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
