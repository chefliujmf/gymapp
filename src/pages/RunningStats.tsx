import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasModule } from '../modules'
import { vdotFromThresholdPace, paceZones, racePredictions, marathonRealism, fmtPace, fmtTime, type RunVolume } from '../running-paces'
import { runningVo2max } from '../vo2max-submax'
import { fetchWellness, fetchEfTrend, fetchPaceCurve, type EfTrend, type PaceCurve } from '../intervals'
import { authApi } from '../auth/api'
import { TrendChart, InfoDot, DurationCurve } from '../charts'
import { BenchmarksCard } from '../Benchmarks'
import SeasonCompare from '../SeasonCompare'

// #508 — the running engine's curve: your pace-duration curve, fitted (as SPEED so faster reads higher), with the
// Critical-Speed asymptote + D′ reserve. Threshold pace · CS · D′ · TTE all derive from THIS one curve.
function PaceCurveCard() {
  const [curve, setCurve] = useState<PaceCurve | null>(null)
  useEffect(() => { fetchPaceCurve(365).then(setCurve).catch(() => {}) }, [])
  if (!curve || !(curve.secs && curve.secs.length >= 3)) return null
  const cs = curve.cs ?? null // m/s
  const dPrime = curve.dPrime != null ? Math.round(curve.dPrime) : null
  const speed = curve.pace.map((p) => (p > 0 ? 1000 / p : 0)) // m/s — higher is faster (top of the chart)
  const insight = cs != null
    ? `One fit, your whole engine: Critical Speed ${fmtPace(Math.round(1000 / cs))}/km is the sustainable floor${dPrime != null ? `, D′ ${dPrime} m the reserve above it` : ''}. Threshold pace, TTE and your zones all read off this curve.`
    : 'Your pace-duration curve. Critical Speed, D′, threshold pace and TTE will all read off it once intervals has efforts across distances.'
  return (
    <div className="card" style={{ padding: 14, marginBottom: 12 }}>
      <div className="section-title" style={{ fontSize: 13, marginBottom: 4 }}>Your pace curve, fitted <InfoDot text="The fastest pace you can hold for each duration (log-time axis, faster = higher). The dashed line is Critical Speed — the pace you can sustain; the shaded area above is D′, your distance reserve for a kick. Threshold pace, TTE and your zones are all derived from this one curve." /></div>
      <DurationCurve secs={curve.secs} values={speed} asymptote={cs} unit="/km" fmt={(mps) => fmtPace(Math.round(1000 / mps))} reserveLabel={dPrime != null ? `D′ ${dPrime} m` : undefined} anchors={[{ sec: 300, label: '5m' }, { sec: 1200, label: '20m' }]} />
      <p className="meta" style={{ marginTop: 6, color: 'var(--text-dim)' }}>{insight}</p>
    </div>
  )
}
// #398 — the Threshold benchmark card (edit + confidence + science) is the ONE place for threshold pace; the
// old duplicate inline ThresholdCell was removed (JM: "threshold there 2 times").

// #225 — Running per-sport stats: threshold pace · Daniels zones · VDOT · race predictions.
// Pulls the running benchmarks (today shown in Profile too — edit in either, #228).
const ZONES: [keyof ReturnType<typeof paceZones>, string, string][] = [
  ['easy', 'Easy', 'recovery & long runs'],
  ['marathon', 'Marathon', 'steady race pace'],
  ['threshold', 'Threshold', 'comfortably hard (~1 h)'],
  ['interval', 'Interval', 'VO₂max efforts'],
  ['rep', 'Rep', 'speed & economy'],
]
// #398 — a cool→warm effort spectrum (easy = recovery blue … rep = redline), matching the pace-curve/zone UX.
const ZONE_COLORS: Record<string, string> = { easy: '#5ec8ff', marathon: '#34e07d', threshold: '#f5b53d', interval: '#ff8f3d', rep: '#ff5d5d' }

export default function RunningStats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [runVol, setRunVol] = useState<{ available: boolean; longestKm?: number; weeklyKm?: number } | null>(null)
  const [hrRest, setHrRest] = useState<number | null>(null) // #234 HR-ratio input
  const [paceTrend, setPaceTrend] = useState<(number | null)[] | null>(null) // #230 per-week avg pace
  const [ef, setEf] = useState<EfTrend | null>(null) // #403 efficiency-factor trend
  const isRunner = hasModule(user?.sports || [], 'running')

  useEffect(() => {
    if (!user?.hasIcuKey || !isRunner) return
    authApi.runVolume().then(setRunVol).catch(() => {})
    authApi.runPaceTrend().then((r) => setPaceTrend(r.available && r.paces ? r.paces : [])).catch(() => {})
    fetchEfTrend('Run', 90).then(setEf).catch(() => {}) // #403
    const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    fetchWellness(from, to).then((rows) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].restingHR != null) { setHrRest(rows[i].restingHR); break } }).catch(() => {})
  }, [user?.hasIcuKey, isRunner])

  const pace = user?.runThresholdPace ?? null // sec/km (edited via the Threshold benchmark card, #398)
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
          {/* #385/#398 — the benchmark cards (Threshold pace · VO₂max · Max HR) are the single source: each shows the
              value + confidence and taps open a sheet to edit (manual value) / switch manual↔computed. No duplicate cell. */}
          <BenchmarksCard only={['thresholdPace', 'cs', 'dPrime', 'vo2max', 'tteRun', 'maxHr']} profile="running" />
          <PaceCurveCard />
          {vo2 && hrRatioMismatch &&<p className="meta" style={{ margin: '10px 2px 6px', color: '#f0b145' }}>⚠️ Your VDOT ({vdot}) from pace is lower than your HR suggests (~{vo2.value}) — your <b>threshold pace may be set too slow/stale</b>. Update it for accurate zones & predictions.</p>}

          {/* #407/#420 — the 2-season overlay IS the pace curve now (removed the old single-range curve to avoid two). */}
          <SeasonCompare sport="running" threshold={pace} />

          {/* #398 — race predictions sit right under the pace curve (both are "what you can do"); the training
              zones ("how to train") follow, colour-coded as a cool→warm effort spectrum. */}
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

          {zones && (
            <>
              <div className="stat-sub">Training pace zones <span className="meta">· target min/km · cool → hard</span></div>
              <div className="zlist">
                {ZONES.map(([k, name, purpose]) => (
                  <div className="zrow zrow--pace" key={k} style={{ '--zc': ZONE_COLORS[k] } as CSSProperties}><span className="zname"><span className="zname-top">{name}</span><span className="zpurpose">{purpose}</span></span><span className="zpace" style={{ color: ZONE_COLORS[k] }}>{zStr(k)}<span className="zunit">/km</span></span></div>
                ))}
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

          {/* #403 — Efficiency Factor: aerobic engine (pace ÷ HR), rising = fitter even when pace is flat. */}
          {ef && ef.points.length >= 2 && (
            <>
              <div className="stat-sub">Efficiency Factor <em>· aerobic engine · pace ÷ HR</em></div>
              <div className="card chart-card" style={{ padding: '12px 14px' }}>
                <TrendChart series={[{ label: 'EF', color: '#34e07d', data: ef.points.map((p) => p.ef), area: true }]} height={110} axes labels={ef.points.map((p) => new Date(p.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))} />
                <p className="fit-insight">{ef.trend === 'up' ? `📈 EF is climbing (${ef.deltaPct != null && ef.deltaPct > 0 ? '+' : ''}${ef.deltaPct}%) — your aerobic engine is improving, even if pace is flat.` : ef.trend === 'down' ? `📉 EF is slipping (${ef.deltaPct}%) — check sleep, stress or fuelling.` : '➡️ EF is steady — a stable aerobic base.'}</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
