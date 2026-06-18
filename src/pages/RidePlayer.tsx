import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentRide, wattsAt } from '../ride'
import { zoneColor, sportIcon } from '../ui'
import { useNow, useWakeLock } from '../hooks'
import { logWorkout } from '../db'
import { localISO } from '../date'
import { bleSupported, connectHeartRate, connectTrainer, type HRHandle, type TrainerData, type TrainerHandle } from '../ble'

function clock(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`
}

export default function RidePlayer() {
  const navigate = useNavigate()
  const ride = getCurrentRide()
  const segs = ride?.segments ?? []
  const ftp = ride?.ftp ?? 260

  const [idx, setIdx] = useState(0)
  const [segStart, setSegStart] = useState(() => Date.now())
  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(0)
  const now = useNow(250)
  useWakeLock(true)

  // --- Bluetooth: trainer (Tacx, ERG) + heart rate (Polar) ---
  const [hr, setHr] = useState<number | undefined>()
  const [live, setLive] = useState<TrainerData>({})
  const [trState, setTrState] = useState<'idle' | 'on' | 'erg'>('idle')
  const [hrState, setHrState] = useState<'idle' | 'on'>('idle')
  const trainerRef = useRef<TrainerHandle | null>(null)
  const hrRef = useRef<HRHandle | null>(null)
  const lastErg = useRef(0)

  async function connectTr() {
    try { const h = await connectTrainer(setLive); trainerRef.current = h; setTrState(h.hasErg ? 'erg' : 'on') } catch { /* cancelled */ }
  }
  async function connectHr() {
    try { const h = await connectHeartRate(setHr); hrRef.current = h; setHrState('on') } catch { /* cancelled */ }
  }
  useEffect(() => () => { trainerRef.current?.disconnect(); hrRef.current?.disconnect() }, [])

  const total = segs.reduce((s, x) => s + x.duration, 0)
  const cur = segs[idx]
  const elapsedInSeg = paused ? pausedAt / 1000 : (now - segStart) / 1000
  const remaining = cur ? Math.max(0, cur.duration - elapsedInSeg) : 0
  const elapsedTotal = segs.slice(0, idx).reduce((s, x) => s + x.duration, 0) + Math.min(elapsedInSeg, cur?.duration ?? 0)

  function advance() {
    if (idx + 1 < segs.length) { setIdx(idx + 1); setSegStart(Date.now()); setPaused(false); setPausedAt(0) }
    else finish()
  }
  // Drive the auto-advance off an absolute timeout so a screen-off gap stays correct.
  useEffect(() => {
    if (!cur || paused) return
    const msLeft = cur.duration * 1000 - (Date.now() - segStart)
    const t = setTimeout(advance, Math.max(0, msLeft))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused, segStart])

  // ERG: keep the trainer's target power matched to the interval (throttled writes).
  useEffect(() => {
    const t = trainerRef.current
    if (!t?.hasErg || paused || !cur) return
    const target = wattsAt(cur, paused ? pausedAt / 1000 : (now - segStart) / 1000, ftp)
    if (Math.abs(target - lastErg.current) >= 2) { lastErg.current = target; t.setTargetPower(target) }
  }, [now, idx, paused, cur, segStart, pausedAt, ftp])

  async function finish() {
    await logWorkout({
      workoutId: ride?.source ?? 'ride',
      title: ride?.title ?? 'Ride',
      discipline: ride?.sport ?? 'cycling',
      duration: Math.round(total / 60),
      date: localISO(),
    })
    navigate('/progress')
  }

  if (!ride || !cur) {
    return <div className="page-head"><h1>No ride loaded</h1><button className="btn" onClick={() => navigate(-1)}>Back</button></div>
  }

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

      {/* connect row */}
      {bleSupported() ? (
        <div className="rp-conn">
          <button className={'rp-pill' + (trState !== 'idle' ? ' on' : '')} onClick={connectTr}>{trState === 'erg' ? '✓ Trainer · ERG' : trState === 'on' ? '✓ Trainer' : '🚴 Connect trainer'}</button>
          <button className={'rp-pill' + (hrState === 'on' ? ' on' : '')} onClick={connectHr}>{hrState === 'on' ? '✓ HR' : '♥ Connect HR'}</button>
        </div>
      ) : <div className="rp-note">Bluetooth pairing needs Chrome on Android over HTTPS</div>}

      <div className="rp-main">
        {/* target */}
        <div className="rp-target" style={{ color: zoneColor(pctNow) }}>{watts}<span>W</span></div>
        <div className="rp-sub">target · {pctNow}% FTP{cur.label ? ` · ${cur.label}W` : ''}{cur.hr ? ` · ${cur.hr} bpm` : ''}{cur.powerStart !== cur.powerEnd ? ' · ramp' : ''}</div>

        {/* live actuals */}
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

      {/* profile graph */}
      <div className="rp-profile">
        {segs.map((s, i) => (
          <div key={i} className="rp-bar" style={{
            flexGrow: s.duration / total,
            height: `${Math.max(10, Math.min(100, (Math.max(s.powerStart, s.powerEnd) / 150) * 100))}%`,
            background: zoneColor(Math.max(s.powerStart, s.powerEnd)),
            opacity: i === idx ? 1 : i < idx ? 0.3 : 0.62,
            outline: i === idx ? '1.5px solid #fff' : 'none',
          }} />
        ))}
        <div className="rp-cursor" style={{ left: `${(elapsedTotal / total) * 100}%` }} />
      </div>
      <div className="rp-tot">{clock(elapsedTotal)} / {clock(total)}</div>

      {/* controls */}
      <div className="rp-controls">
        <button className="rctrl" onClick={() => { setIdx(Math.max(0, idx - 1)); setSegStart(Date.now()); setPaused(false); setPausedAt(0) }}>‹‹</button>
        <button className="rctrl rctrl--big" onClick={() => { if (paused) { setSegStart(Date.now() - pausedAt); setPaused(false) } else { setPausedAt(now - segStart); setPaused(true) } }}>
          {paused ? '▶' : '⏸'}
        </button>
        <button className="rctrl" onClick={advance}>››</button>
      </div>
    </div>
  )
}
