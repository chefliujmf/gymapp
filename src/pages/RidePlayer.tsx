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

  return (
    <div className="player" style={{ background: '#0c0c0e', minHeight: '100dvh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14 }}>
        <button className="player-x" onClick={() => { if (confirm('Stop the ride?')) navigate(-1) }}>✕</button>
        <div style={{ opacity: 0.7, fontSize: 13 }}>{sportIcon[ride.sport]} {ride.title}</div>
        <div style={{ width: 28 }} />
      </div>

      {/* connect row */}
      {bleSupported() ? (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '0 14px' }}>
          <button className="rctrl" style={{ minWidth: 0, height: 34, padding: '0 12px', fontSize: 12, background: trState !== 'idle' ? 'rgba(52,224,125,.2)' : undefined }} onClick={connectTr}>
            {trState === 'erg' ? '✓ Trainer (ERG)' : trState === 'on' ? '✓ Trainer' : '🚴 Connect trainer'}
          </button>
          <button className="rctrl" style={{ minWidth: 0, height: 34, padding: '0 12px', fontSize: 12, background: hrState === 'on' ? 'rgba(52,224,125,.2)' : undefined }} onClick={connectHr}>
            {hrState === 'on' ? '✓ HR' : '♥ Connect HR'}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', opacity: 0.5, fontSize: 11, padding: '0 14px' }}>Bluetooth needs Chrome on Android over HTTPS</div>
      )}

      {/* big target + live actuals */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1, color: zoneColor(pctNow) }}>{watts}<span style={{ fontSize: 22 }}>W</span></div>
        <div style={{ opacity: 0.7 }}>target · {pctNow}% FTP{cur.powerStart !== cur.powerEnd ? ' · ramp' : ''}</div>
        {(trState !== 'idle' || hrState === 'on') && (
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 10, fontSize: 15, fontWeight: 700 }}>
            {trState !== 'idle' && <span>⚡ {live.power ?? '–'}<small style={{ opacity: .6 }}>W</small></span>}
            {trState !== 'idle' && live.cadence != null && <span>{Math.round(live.cadence)}<small style={{ opacity: .6 }}>rpm</small></span>}
            {hrState === 'on' && <span style={{ color: '#ff6b6b' }}>♥ {hr ?? '–'}</span>}
          </div>
        )}
        <div style={{ fontSize: 40, fontWeight: 700, marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>{clock(remaining)}</div>
        <div style={{ opacity: 0.6, fontSize: 13 }}>interval {idx + 1} / {segs.length}{next ? ` · next ${Math.round(next.powerStart)}%` : ' · last'}</div>
      </div>

      {/* moving profile */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, padding: '24px 12px', position: 'relative' }}>
        {segs.map((s, i) => (
          <div key={i} style={{
            flexGrow: s.duration / total, flexBasis: 0,
            height: `${Math.max(8, (Math.max(s.powerStart, s.powerEnd) / 150) * 100)}%`,
            background: zoneColor(Math.max(s.powerStart, s.powerEnd)),
            opacity: i === idx ? 1 : i < idx ? 0.35 : 0.7,
            borderRadius: '3px 3px 0 0',
            outline: i === idx ? '2px solid #fff' : 'none',
          }} />
        ))}
        <div style={{ position: 'absolute', left: `calc(12px + ${(elapsedTotal / total) * 100}% )`, top: 0, bottom: 0, width: 2, background: '#fff', opacity: 0.5 }} />
      </div>

      <div style={{ textAlign: 'center', opacity: 0.6, fontSize: 13 }}>{clock(elapsedTotal)} / {clock(total)}</div>

      {/* controls */}
      <div style={{ display: 'flex', gap: 10, padding: 16, justifyContent: 'center' }}>
        <button className="rctrl" onClick={() => { setIdx(Math.max(0, idx - 1)); setSegStart(Date.now()); setPaused(false); setPausedAt(0) }}>‹‹</button>
        <button className="rctrl rctrl--big" onClick={() => { if (paused) { setSegStart(Date.now() - pausedAt); setPaused(false) } else { setPausedAt(now - segStart); setPaused(true) } }}>
          {paused ? '▶' : '⏸'}
        </button>
        <button className="rctrl" onClick={advance}>››</button>
      </div>
    </div>
  )
}
