import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentRide, wattsAt } from '../ride'
import { zoneColor, sportIcon } from '../ui'
import { useBeeper, useNow, useWakeLock } from '../hooks'
import { logWorkout } from '../db'
import { localISO } from '../date'
import { useBle, BleDevices } from '../BleContext'
import { Bluetooth } from 'lucide-react'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`
const zoneOf = (pct: number) => pct < 55 ? 1 : pct < 75 ? 2 : pct < 90 ? 3 : pct < 105 ? 4 : pct < 120 ? 5 : pct < 150 ? 6 : 7

/** Semicircle power gauge (#104): filled arc = live power, white tick = target. */
function Gauge({ live, target, max, color, deltaColor }: { live?: number; target: number; max: number; color: string; deltaColor: string }) {
  const W = 240, H = 128, cx = 120, cy = 120, r = 100
  const ang = (v: number) => -180 + Math.min(1, Math.max(0, v / max)) * 180 // degrees, 0W=left(-180), max=right(0)
  const pt = (a: number, rr: number) => `${(cx + rr * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(cy + rr * Math.sin((a * Math.PI) / 180)).toFixed(1)}`
  const arcLen = Math.PI * r // semicircle length
  const fill = live != null ? Math.min(1, live / max) : 0
  const tA = ang(target)
  return (
    <svg className="rp-gauge" width="100%" viewBox={`0 0 ${W} ${H}`}>
      <path d={`M ${pt(-180, r)} A ${r} ${r} 0 0 1 ${pt(0, r)}`} fill="none" stroke="#1b1f27" strokeWidth="15" strokeLinecap="round" />
      {live != null && <path d={`M ${pt(-180, r)} A ${r} ${r} 0 0 1 ${pt(0, r)}`} fill="none" stroke={deltaColor} strokeWidth="15" strokeLinecap="round" strokeDasharray={`${fill * arcLen} ${arcLen}`} />}
      <line x1={pt(tA, 78).split(' ')[0]} y1={pt(tA, 78).split(' ')[1]} x2={pt(tA, 110).split(' ')[0]} y2={pt(tA, 110).split(' ')[1]} stroke="#fff" strokeWidth="3" />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fill="var(--text-dim)" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{color ? '' : ''}target {target}W</text>
    </svg>
  )
}

export default function RidePlayer() {
  const navigate = useNavigate()
  const ride = getCurrentRide()
  const segs = ride?.segments ?? []
  const ftp = ride?.ftp ?? 260
  const beep = useBeeper()

  const [phase, setPhase] = useState<'setup' | 'countdown' | 'ride'>('setup')
  const [showDevices, setShowDevices] = useState(false)
  const [cdStart, setCdStart] = useState(0)
  const [idx, setIdx] = useState(0)
  const [segStart, setSegStart] = useState(() => Date.now())
  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(0)
  const now = useNow(250)
  useWakeLock(true)

  const ble = useBle()
  const live = ble.live
  const hr = ble.bpm
  const trState: 'idle' | 'on' | 'erg' = ble.trainer ? (ble.trainer.hasErg ? 'erg' : 'on') : ble.bridge?.trainer ? 'erg' : 'idle'
  const hrState: 'idle' | 'on' = ble.hrDev || ble.bridge?.hr ? 'on' : 'idle'
  // Intensity bias (#105) — scale the whole workout's watts down on a bad day.
  const [bias, setBias] = useState(1)
  const lastErg = useRef(0)

  const total = segs.reduce((s, x) => s + x.duration, 0)
  const cur = segs[idx]
  const elapsedInSeg = paused ? pausedAt / 1000 : (now - segStart) / 1000
  const remaining = cur ? Math.max(0, cur.duration - elapsedInSeg) : 0
  const elapsedTotal = segs.slice(0, idx).reduce((s, x) => s + x.duration, 0) + Math.min(elapsedInSeg, cur?.duration ?? 0)

  function advance() {
    if (idx + 1 < segs.length) { setIdx(idx + 1); setSegStart(Date.now()); setPaused(false); setPausedAt(0) }
    else finish()
  }

  // 10-second "get ready" countdown.
  const cd = phase === 'countdown' ? Math.ceil(10 - (now - cdStart) / 1000) : 0
  const lastCd = useRef(11)
  useEffect(() => {
    if (phase !== 'countdown') return
    if (cd !== lastCd.current) { lastCd.current = cd; if (cd >= 1 && cd <= 5) beep(cd <= 1 ? 1320 : 880, 0.09) }
    if (cd <= 0) { setPhase('ride'); setSegStart(Date.now()); setPaused(false) }
  }, [cd, phase, beep])

  // Auto-advance (ride only), absolute-time so a screen-off gap stays correct.
  useEffect(() => {
    if (phase !== 'ride' || !cur || paused) return
    const t = setTimeout(advance, Math.max(0, cur.duration * 1000 - (Date.now() - segStart)))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused, segStart, phase])

  // ERG: pre-set the first target during the countdown (trainer spins up), then
  // keep it matched to the interval during the ride. Throttled writes.
  useEffect(() => {
    if (trState !== 'erg' || paused || !cur || phase === 'setup') return
    const target = Math.round((phase === 'ride' ? wattsAt(cur, elapsedInSeg, ftp) : wattsAt(cur, 0, ftp)) * bias)
    if (Math.abs(target - lastErg.current) >= 2) { lastErg.current = target; ble.setTargetPower(target) }
  }, [now, idx, paused, cur, segStart, pausedAt, ftp, phase, trState, ble, elapsedInSeg, bias])

  async function finish() {
    await logWorkout({ workoutId: ride?.source ?? 'ride', title: ride?.title ?? 'Ride', discipline: ride?.sport ?? 'cycling', duration: Math.round(total / 60), date: localISO() })
    navigate('/progress')
  }

  if (!ride || !cur) return <div className="page-head"><h1>No ride loaded</h1><button className="btn" onClick={() => navigate(-1)}>Back</button></div>

  const firstW = wattsAt(segs[0], 0, ftp)
  const profile = (
    <div className="rp-profile">
      {segs.map((s, i) => (
        <div key={i} className="rp-bar" style={{
          flexGrow: s.duration / total,
          height: `${Math.max(10, Math.min(100, (Math.max(s.powerStart, s.powerEnd) / 150) * 100))}%`,
          background: zoneColor(Math.max(s.powerStart, s.powerEnd)),
          opacity: phase === 'ride' ? (i === idx ? 1 : i < idx ? 0.3 : 0.62) : 0.8,
          outline: phase === 'ride' && i === idx ? '1.5px solid #fff' : 'none',
        }} />
      ))}
      {phase === 'ride' && <div className="rp-cursor" style={{ left: `${(elapsedTotal / total) * 100}%` }} />}
    </div>
  )
  const liveRow = (trState !== 'idle' || hrState === 'on') && (
    <div className="rp-live">
      {trState !== 'idle' && <div className="rp-stat"><b>{live.power ?? '–'}</b><small>watts</small></div>}
      {trState !== 'idle' && <div className="rp-stat"><b>{live.cadence != null ? Math.round(live.cadence) : '–'}</b><small>rpm</small></div>}
      {hrState === 'on' && <div className="rp-stat"><b style={{ color: '#ff6b6b' }}>{hr || '–'}</b><small>bpm</small></div>}
    </div>
  )
  // Devices reachable from ANY phase (like JOIN's in-workout devices page) — pair a
  // trainer or HR (Garmin/Coros watch, strap, …) without leaving the ride.
  const deviceConnected = trState !== 'idle' || hrState === 'on'
  const deviceBtn = (
    <button className="rp-x" onClick={() => setShowDevices(true)} title="Devices" style={deviceConnected ? { color: 'var(--accent)' } : undefined}><Bluetooth size={18} /></button>
  )
  const deviceSheet = showDevices && (
    <div className="sheet-overlay" onClick={() => setShowDevices(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><strong>Devices</strong><button className="btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setShowDevices(false)}>Done</button></div>
        <BleDevices />
        {liveRow}
      </div>
    </div>
  )

  // ---- SETUP: pair devices, then Start ----
  if (phase === 'setup') {
    return (
      <div className="rp">
        <div className="rp-top">
          <button className="rp-x" onClick={() => navigate(-1)}>✕</button>
          <div className="rp-title">{sportIcon[ride.sport]} {ride.title}</div>
          <div style={{ width: 32 }} />
        </div>
        <div className="rp-setup">
          {profile}
          <div className="rp-setup-meta">{Math.round(total / 60)} min · first target {firstW} W ({Math.round(segs[0].powerStart)}% FTP)</div>
          <div className="rp-setup-pair">Devices</div>
          <BleDevices />
          {liveRow}
          <button className="btn" style={{ marginTop: 18 }} onClick={() => { setCdStart(Date.now()); setPhase('countdown') }}>▶ Start ride</button>
        </div>
      </div>
    )
  }

  // ---- COUNTDOWN ----
  if (phase === 'countdown') {
    return (
      <div className="rp">
        <div className="rp-top">
          <button className="rp-x" onClick={() => navigate(-1)}>✕</button>
          <div className="rp-title">{ride.title}</div>
          {deviceBtn}
        </div>
        {deviceSheet}
        <div className="rp-main">
          <div className="rp-sub">GET READY</div>
          <div className="rp-target" style={{ color: 'var(--accent)' }}>{Math.max(0, cd)}</div>
          <div className="rp-sub" style={{ marginTop: 12 }}>first: {firstW} W · {Math.round(segs[0].powerStart)}% FTP</div>
          {liveRow}
        </div>
        <button className="rctrl" style={{ margin: '0 auto 18px', minWidth: 120 }} onClick={() => { setPhase('ride'); setSegStart(Date.now()); setPaused(false) }}>Skip ››</button>
      </div>
    )
  }

  // ---- RIDE ----
  const rawWatts = wattsAt(cur, elapsedInSeg, ftp)
  const target = Math.round(rawWatts * bias)        // biased target (#105)
  const pctNow = Math.round((cur.powerStart + (cur.powerEnd - cur.powerStart) * (cur.duration ? Math.min(1, elapsedInSeg / cur.duration) : 0)) * bias)
  const next = segs[idx + 1]
  const hasLive = trState !== 'idle' && live.power != null
  const delta = hasLive ? (live.power as number) - target : undefined
  const deltaColor = delta == null ? 'var(--text)' : Math.abs(delta) <= 10 ? 'var(--accent)' : delta > 0 ? '#ffb13d' : '#5ec8ff'
  return (
    <div className="rp">
      <div className="rp-top">
        <button className="rp-x" onClick={() => { if (confirm('Stop the ride?')) navigate(-1) }}>✕</button>
        <div className="rp-title">{sportIcon[ride.sport]} {ride.title}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{deviceBtn}<button className="rp-fin" onClick={finish}>Finish</button></div>
      </div>
      {deviceSheet}

      <div className="rp-main">
        {/* interval position + time left in THIS interval */}
        <div className="rp-iv">interval {idx + 1} / {segs.length} · {clock(remaining)} left{next ? ` · next ${Math.round(next.powerStart * bias)}% FTP` : ' · last'}</div>

        <Gauge live={hasLive ? (live.power as number) : undefined} target={target} max={Math.max(target * 1.4, 200)} color={zoneColor(pctNow)} deltaColor={deltaColor} />

        {/* hero: YOUR live power (falls back to target if no trainer) */}
        {hasLive
          ? <div className="rp-hero" style={{ color: deltaColor }}>{live.power}<span>W</span><em>your power</em></div>
          : <div className="rp-hero" style={{ color: zoneColor(pctNow) }}>{target}<span>W</span><em>target</em></div>}

        {/* target + ERG + delta */}
        <div className="rp-targetrow">
          {trState === 'erg' && <span className="rp-erg">⚡ ERG</span>}
          <span className="rp-tgt">target <b>{target}</b> W · {pctNow}% FTP</span>
          {delta != null && <span className="rp-delta" style={{ color: deltaColor }}>{delta > 0 ? '+' : ''}{delta}</span>}
        </div>

        {/* live secondary stats */}
        {(hasLive || hrState === 'on') && (
          <div className="rp-live">
            {trState !== 'idle' && <div className="rp-stat"><b>{live.cadence != null ? Math.round(live.cadence) : '–'}</b><small>rpm</small></div>}
            {hrState === 'on' && <div className="rp-stat"><b style={{ color: '#ff6b6b' }}>{hr || '–'}</b><small>bpm</small></div>}
            <div className="rp-stat"><b>{cur.powerStart === cur.powerEnd ? `Z${zoneOf(pctNow)}` : 'ramp'}</b><small>zone</small></div>
          </div>
        )}

        {/* intensity bias — reduce the whole workout on a bad day (#105) */}
        <div className="rp-bias">
          <button className="rp-bias__b" onClick={() => setBias((b) => Math.max(0.5, Math.round((b - 0.05) * 100) / 100))} aria-label="Easier">−</button>
          <span className="rp-bias__v">{Math.round(bias * 100)}%<small>intensity</small></span>
          <button className="rp-bias__b" onClick={() => setBias((b) => Math.min(1.2, Math.round((b + 0.05) * 100) / 100))} aria-label="Harder">+</button>
        </div>
      </div>

      {profile}
      <div className="rp-tot">{clock(elapsedTotal)} / {clock(total)}</div>

      <div className="rp-controls">
        <button className="rctrl" onClick={() => { setIdx(Math.max(0, idx - 1)); setSegStart(Date.now()); setPaused(false); setPausedAt(0) }}>‹‹</button>
        <button className="rctrl rctrl--big" onClick={() => { if (paused) { setSegStart(Date.now() - pausedAt); setPaused(false) } else { setPausedAt(now - segStart); setPaused(true) } }}>{paused ? '▶' : '⏸'}</button>
        <button className="rctrl" onClick={advance}>››</button>
      </div>
    </div>
  )
}
