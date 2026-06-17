import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentRide, wattsAt } from '../ride'
import { zoneColor, sportIcon } from '../ui'
import { useNow, useWakeLock } from '../hooks'
import { logWorkout } from '../db'

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

  async function finish() {
    await logWorkout({
      workoutId: ride?.source ?? 'ride',
      title: ride?.title ?? 'Ride',
      discipline: ride?.sport ?? 'cycling',
      duration: Math.round(total / 60),
      date: new Date().toISOString().slice(0, 10),
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

      {/* big target */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, color: zoneColor(pctNow) }}>{watts}<span style={{ fontSize: 22 }}>W</span></div>
        <div style={{ opacity: 0.7 }}>{pctNow}% FTP{cur.powerStart !== cur.powerEnd ? ' · ramp' : ''}</div>
        <div style={{ fontSize: 40, fontWeight: 700, marginTop: 14, fontVariantNumeric: 'tabular-nums' }}>{clock(remaining)}</div>
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
