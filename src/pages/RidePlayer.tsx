import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentRide, wattsAt } from '../ride'
import { zoneColor, sportIcon } from '../ui'
import { useBeeper, useNow, useWakeLock } from '../hooks'
import { logWorkout } from '../db'
import { localISO } from '../date'
import { useBle, BleDevices } from '../BleContext'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`

export default function RidePlayer() {
  const navigate = useNavigate()
  const ride = getCurrentRide()
  const segs = ride?.segments ?? []
  const ftp = ride?.ftp ?? 260
  const beep = useBeeper()

  const [phase, setPhase] = useState<'setup' | 'countdown' | 'ride'>('setup')
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
  const trState: 'idle' | 'on' | 'erg' = ble.trainer ? (ble.trainer.hasErg ? 'erg' : 'on') : 'idle'
  const hrState: 'idle' | 'on' = ble.hrDev ? 'on' : 'idle'
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
    const target = phase === 'ride' ? wattsAt(cur, elapsedInSeg, ftp) : wattsAt(cur, 0, ftp)
    if (Math.abs(target - lastErg.current) >= 2) { lastErg.current = target; ble.setTargetPower(target) }
  }, [now, idx, paused, cur, segStart, pausedAt, ftp, phase, trState, ble, elapsedInSeg])

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
      {hrState === 'on' && <div className="rp-stat"><b style={{ color: '#ff6b6b' }}>{hr ?? '–'}</b><small>bpm</small></div>}
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
          <div style={{ width: 32 }} />
        </div>
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
  const watts = wattsAt(cur, elapsedInSeg, ftp)
  const pctNow = Math.round(cur.powerStart + (cur.powerEnd - cur.powerStart) * (cur.duration ? Math.min(1, elapsedInSeg / cur.duration) : 0))
  const next = segs[idx + 1]
  const over = live.power != null && trState !== 'idle' ? live.power - watts : undefined
  return (
    <div className="rp">
      <div className="rp-top">
        <button className="rp-x" onClick={() => { if (confirm('Stop the ride?')) navigate(-1) }}>✕</button>
        <div className="rp-title">{sportIcon[ride.sport]} {ride.title}</div>
        <button className="rp-fin" onClick={finish}>Finish</button>
      </div>

      <div className="rp-main">
        <div className="rp-target" style={{ color: zoneColor(pctNow) }}>{watts}<span>W</span></div>
        <div className="rp-sub">target · {pctNow}% FTP{cur.label ? ` · ${cur.label}W` : ''}{cur.hr ? ` · ${cur.hr} bpm` : ''}{cur.powerStart !== cur.powerEnd ? ' · ramp' : ''}</div>
        {(trState !== 'idle' || hrState === 'on') && (
          <div className="rp-live">
            {trState !== 'idle' && <div className="rp-stat"><b style={{ color: over != null ? (Math.abs(over) <= 10 ? 'var(--accent)' : over > 0 ? '#ffb13d' : '#7fd1ff') : undefined }}>{live.power ?? '–'}</b><small>watts</small></div>}
            {trState !== 'idle' && <div className="rp-stat"><b>{live.cadence != null ? Math.round(live.cadence) : '–'}</b><small>rpm</small></div>}
            {hrState === 'on' && <div className="rp-stat"><b style={{ color: '#ff6b6b' }}>{hr ?? '–'}</b><small>bpm</small></div>}
          </div>
        )}
        <div className="rp-timer">{clock(remaining)}</div>
        <div className="rp-iv">interval {idx + 1} / {segs.length}{next ? ` · next ${Math.round(next.powerStart)}% FTP` : ' · last interval'}</div>
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
