import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getCurrentRide, isMobileDevice } from '../ride'
import { zoneColor, sportIcon } from '../ui'
import { useBeeper, useNow, useWakeLock, useSpeech } from '../hooks'
import { logWorkout, getSetting } from '../db'
import { vdotFromThresholdPace, zonePaceForPct, fmtPace } from '../running-paces'
import { localISO } from '../date'
import { useBle, BleDevices } from '../BleContext'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`

// Running effort descriptor from % of threshold pace/HR (segment.powerStart).
function effort(pct: number): string {
  if (pct < 78) return 'easy'
  if (pct < 88) return 'steady'
  if (pct < 100) return 'threshold'
  if (pct < 110) return 'hard'
  return 'sprint'
}

export default function RunPlayer() {
  const navigate = useNavigate()
  const run = getCurrentRide()
  const segs = run?.segments ?? []
  const beep = useBeeper()
  const say = useSpeech()

  const [phase, setPhase] = useState<'setup' | 'countdown' | 'run'>('setup')
  const [cdStart, setCdStart] = useState(0)
  const [idx, setIdx] = useState(0)
  const [segStart, setSegStart] = useState(() => Date.now())
  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(0)
  const now = useNow(250)
  useWakeLock(true)

  const ble = useBle()
  const hr = ble.bpm
  const hrState: 'idle' | 'on' = ble.hrDev ? 'on' : 'idle'

  // #209: turn each segment's "% of threshold" into a real target pace from the runner's VDOT.
  const runTp = useLiveQuery(() => getSetting('runThresholdPace'))
  const runVdot = runTp && Number(runTp) > 0 ? vdotFromThresholdPace(Number(runTp)) : null

  const total = segs.reduce((s, x) => s + x.duration, 0)
  const cur = segs[idx]
  const elapsedInSeg = paused ? pausedAt / 1000 : (now - segStart) / 1000
  const remaining = cur ? Math.max(0, cur.duration - elapsedInSeg) : 0
  const elapsedTotal = segs.slice(0, idx).reduce((s, x) => s + x.duration, 0) + Math.min(elapsedInSeg, cur?.duration ?? 0)

  // Spoken description of a segment, e.g. "threshold, 4 minutes, aim 165 bpm".
  function describe(i: number): string {
    const s = segs[i]; if (!s) return ''
    const mins = Math.round(s.duration / 60)
    const dur = mins >= 1 ? `${mins} minute${mins > 1 ? 's' : ''}` : `${s.duration} seconds`
    return `${effort(s.powerStart)}, ${dur}${s.hr ? `, aim ${s.hr} b p m` : ''}`
  }

  function advance() {
    if (idx + 1 < segs.length) { const n = idx + 1; setIdx(n); setSegStart(Date.now()); setPaused(false); setPausedAt(0); say(`Interval ${n + 1}: ${describe(n)}`) }
    else finish()
  }

  // 10-second countdown with beeps; speak the first interval as it starts.
  const cd = phase === 'countdown' ? Math.ceil(10 - (now - cdStart) / 1000) : 0
  const lastCd = useRef(11)
  useEffect(() => {
    if (phase !== 'countdown') return
    if (cd !== lastCd.current) { lastCd.current = cd; if (cd >= 1 && cd <= 5) beep(cd <= 1 ? 1320 : 880, 0.09) }
    if (cd <= 0) { setPhase('run'); setSegStart(Date.now()); setPaused(false); say(`Go. Interval 1: ${describe(0)}`) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cd, phase])

  // Auto-advance, absolute-time so a screen-off gap stays correct.
  useEffect(() => {
    if (phase !== 'run' || !cur || paused) return
    const t = setTimeout(advance, Math.max(0, cur.duration * 1000 - (Date.now() - segStart)))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused, segStart, phase])

  async function finish() {
    await logWorkout({ workoutId: run?.source ?? 'run', title: run?.title ?? 'Run', discipline: 'running', duration: Math.round(total / 60), date: localISO() })
    navigate('/progress')
  }

  if (!run || !cur) return <div className="page-head"><h1>No run loaded</h1><button className="btn" onClick={() => navigate(-1)}>Back</button></div>

  const profile = (
    <div className="rp-profile">
      {segs.map((s, i) => (
        <div key={i} className="rp-bar" style={{
          flexGrow: s.duration / total,
          height: `${Math.max(10, Math.min(100, (Math.max(s.powerStart, s.powerEnd) / 130) * 100))}%`,
          background: zoneColor(Math.max(s.powerStart, s.powerEnd)),
          opacity: phase === 'run' ? (i === idx ? 1 : i < idx ? 0.3 : 0.62) : 0.8,
          outline: phase === 'run' && i === idx ? '1.5px solid #fff' : 'none',
        }} />
      ))}
      {phase === 'run' && <div className="rp-cursor" style={{ left: `${(elapsedTotal / total) * 100}%` }} />}
    </div>
  )
  const hrRow = hrState === 'on' && (
    <div className="rp-live"><div className="rp-stat"><b style={{ color: '#ff6b6b' }}>{hr ?? '–'}</b><small>bpm</small></div></div>
  )

  // ---- SETUP ----
  if (phase === 'setup') {
    return (
      <div className="rp">
        <div className="rp-top">
          <button className="rp-x" onClick={() => navigate(-1)}>✕</button>
          <div className="rp-title">{sportIcon[run.sport]} {run.title}</div>
          <div style={{ width: 32 }} />
        </div>
        <div className="rp-setup">
          {profile}
          <div className="rp-setup-meta">{Math.round(total / 60)} min · {segs.length} intervals · spoken cues</div>
          <div className="rp-setup-pair">Heart rate (optional)</div>
          <BleDevices />
          {hrRow}
          <button className="btn" style={{ marginTop: 18 }} onClick={() => { say('Get ready'); setCdStart(Date.now()); setPhase('countdown') }}>▶ Start run</button>
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
          <div className="rp-title">{run.title}</div>
          <div style={{ width: 32 }} />
        </div>
        <div className="rp-main">
          <div className="rp-sub">GET READY</div>
          <div className="rp-target" style={{ color: 'var(--accent)' }}>{Math.max(0, cd)}</div>
          <div className="rp-sub" style={{ marginTop: 12 }}>first: {effort(segs[0].powerStart)} · {Math.round(segs[0].duration / 60) || Math.round(segs[0].duration)}{segs[0].duration >= 60 ? ' min' : 's'}</div>
          {hrRow}
        </div>
        <button className="rctrl" style={{ margin: '0 auto 18px', minWidth: 120 }} onClick={() => { setPhase('run'); setSegStart(Date.now()); setPaused(false); say(`Go. Interval 1: ${describe(0)}`) }}>Skip ››</button>
      </div>
    )
  }

  // Mobile-first (#109/#139): on a desktop without the sensor bridge, send them to
  // the phone instead of a sensor-less run (mirrors RidePlayer's gate).
  const isMobile = isMobileDevice() // #139/#145 — shared gate (narrow desktop window ≠ mobile)
  if (!isMobile && !ble.bridge) return (
    <div className="rp">
      <div className="rp-top"><button className="rp-x" onClick={() => navigate(-1)}>✕</button><div className="rp-title">{sportIcon[run.sport]} {run.title}</div><div style={{ width: 34 }} /></div>
      <div className="rp-main" style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 56 }}>📱</div>
        <h2 style={{ margin: '8px 0 6px' }}>Run from your phone</h2>
        <p className="meta" style={{ maxWidth: 340, lineHeight: 1.5 }}>Open Platyplus on your phone to do this run — that's where your HR strap connects (Bluetooth works on mobile). Pop it in an armband or pocket.</p>
        <button className="btn" style={{ marginTop: 18, width: 'auto', padding: '12px 22px' }} onClick={() => navigate(-1)}>Got it</button>
      </div>
    </div>
  )

  // ---- RUN ----
  const pct = Math.round(cur.powerStart + (cur.powerEnd - cur.powerStart) * (cur.duration ? Math.min(1, elapsedInSeg / cur.duration) : 0))
  const next = segs[idx + 1]
  const tgtHr = cur.hr ? Number(cur.hr) : 0
  return (
    <div className="rp">
      <div className="rp-top">
        <button className="rp-x" onClick={() => { if (confirm('Stop the run?')) navigate(-1) }}>✕</button>
        <div className="rp-title">{sportIcon[run.sport]} {run.title}</div>
        <button className="rp-fin" onClick={finish}>Finish</button>
      </div>

      <div className="rp-main">
        <div className="rp-target" style={{ color: zoneColor(pct), textTransform: 'capitalize' }}>{effort(cur.powerStart)}</div>
        <div className="rp-sub">{pct}% threshold{runVdot ? ` · ~${fmtPace(zonePaceForPct(runVdot, cur.powerStart))}/km` : ''}{cur.label ? ` · ${cur.label}` : ''}{cur.hr ? ` · aim ${cur.hr} bpm` : ''}</div>
        {hrState === 'on' && (
          <div className="rp-live"><div className="rp-stat"><b style={{ color: tgtHr && hr ? (Math.abs(hr - tgtHr) <= 5 ? 'var(--accent)' : hr > tgtHr ? '#ffb13d' : '#7fd1ff') : '#ff6b6b' }}>{hr ?? '–'}</b><small>bpm{tgtHr ? ` · tgt ${tgtHr}` : ''}</small></div></div>
        )}
        <div className="rp-timer">{clock(remaining)}</div>
        <div className="rp-iv">interval {idx + 1} / {segs.length}{next ? ` · next ${effort(next.powerStart)}` : ' · last interval'}</div>
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
