import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWorkoutsById, allExercisesById } from '../data/catalog'
import { useBeeper, useNow, useWakeLock } from '../hooks'
import { getSetting, setSetting, getTemplate, lastLogForWorkout, logWorkout, type SetEntry } from '../db'
import { getGymSession } from '../plan'
import { localISO } from '../date'
import { gymTSS, type GymIntensity } from '../tss'


interface PlayerEx {
  name: string; exId?: string
  image?: string; video?: string; imageFemale?: string; videoFemale?: string
  mode: 'timed' | 'reps'
  seconds: number; rest: number; sets: number; reps: number; weight?: number
  group?: string
}
interface Session { workoutId: string; title: string; discipline: string; duration: number; exercises: PlayerEx[]; intensity?: GymIntensity }

type Step =
  | { kind: 'ready'; duration: number; next?: PlayerEx }
  | { kind: 'timed'; duration: number; ex: PlayerEx; exNo: number; exIndex: number }
  | { kind: 'set'; ex: PlayerEx; exNo: number; exIndex: number; setNo: number; sets: number; reps: number; weight?: number }
  | { kind: 'rest'; duration: number; next: PlayerEx; nextNo: number }

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`

function enrich(name: string, exId: string | undefined, img?: string, vid?: string) {
  const lib = exId ? allExercisesById[exId] : undefined
  return { name, exId, image: lib?.image ?? img, video: lib?.video ?? vid, imageFemale: lib?.imageFemale, videoFemale: lib?.videoFemale }
}

const DEFAULT_REST = 75   // seconds of rest between sets when the coach didn't specify one

function buildSteps(exs: PlayerEx[]): Step[] {
  const steps: Step[] = [] // no "get ready" — start on the first exercise
  exs.forEach((ex, i) => {
    if (ex.mode === 'reps') {
      const sets = Math.max(1, ex.sets)
      for (let s = 1; s <= sets; s++) {
        steps.push({ kind: 'set', ex, exNo: i + 1, exIndex: i, setNo: s, sets, reps: ex.reps, weight: ex.weight })
        const last = i === exs.length - 1 && s === sets
        // Always give a rest countdown between sets (background timer), default if unset.
        if (!last) steps.push({ kind: 'rest', duration: ex.rest > 0 ? ex.rest : DEFAULT_REST, next: s < sets ? ex : exs[i + 1], nextNo: s < sets ? i + 1 : i + 2 })
      }
    } else {
      steps.push({ kind: 'timed', duration: ex.seconds, ex, exNo: i + 1, exIndex: i })
      if (ex.rest > 0 && i < exs.length - 1) steps.push({ kind: 'rest', duration: ex.rest, next: exs[i + 1], nextNo: i + 2 })
    }
  })
  return steps
}

function StageVideo({ ex, female, stills }: { ex: PlayerEx; female: boolean; stills: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)
  const video = female && ex.videoFemale ? ex.videoFemale : ex.video
  const image = female && ex.imageFemale ? ex.imageFemale : ex.image
  useEffect(() => { if (!stills) { setPaused(false); ref.current?.play().catch(() => {}) } }, [video, stills])
  if (stills || !video) return image ? <img className="gp2-vid" src={image} alt={ex.name} /> : <div className="gp2-vid" />
  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) { v.play().catch(() => {}); setPaused(false) } else { v.pause(); setPaused(true) } }
  return (
    <div className="gp2-vidwrap" onClick={toggle} title="Tap to pause/play">
      <video ref={ref} key={video} className="gp2-vid" src={video} poster={image} muted loop playsInline autoPlay />
      {paused && <div className="gp2-vidpause">▶</div>}
    </div>
  )
}

export default function GymPlayer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const path = useLocation().pathname
  const isTemplate = path.includes('/template/')
  const isSession = path.includes('/gym-session')
  const beep = useBeeper()
  const gender = (useLiveQuery(() => getSetting('gender')) as 'male' | 'female' | undefined) ?? 'male'
  const female = gender === 'female'

  const catalog = !isTemplate && !isSession && id ? allWorkoutsById[id] : undefined
  const [w, setW] = useState<Session | undefined>(() => catalog
    ? { workoutId: catalog.id, title: catalog.title, discipline: catalog.discipline, duration: catalog.duration,
        exercises: (catalog.exercises ?? []).map((e) => ({ ...enrich(e.name, undefined, e.image, e.video), mode: 'timed' as const, seconds: e.seconds || 40, rest: e.rest || 0, sets: 1, reps: 0, group: e.note })) }
    : undefined)

  // Ad-hoc session from the intervals.icu plan (coach's gym workout).
  useEffect(() => {
    if (!isSession) return
    const s = getGymSession()
    if (!s) return
    const exs: PlayerEx[] = s.exercises.map((x) => ({ ...enrich(x.name, x.exId, x.image, x.video), mode: x.mode, seconds: x.seconds, rest: x.rest, sets: x.sets, reps: x.reps, group: x.note }))
    const dur = Math.round(exs.reduce((a, e) => a + (e.mode === 'reps' ? e.sets * (30 + e.rest) : e.seconds + e.rest), 0) / 60)
    setW({ workoutId: s.workoutId, title: s.title, discipline: 'strength', duration: dur, exercises: exs, intensity: s.intensity })
  }, [isSession])

  useEffect(() => {
    if (!isTemplate || !id) return
    getTemplate(Number(id)).then((t) => {
      if (!t) return
      const exs: PlayerEx[] = []
      for (let r = 0; r < (t.rounds || 1); r++)
        for (const x of t.exercises)
          exs.push({ ...enrich(x.name, x.exId, x.image, x.video), mode: x.mode ?? 'timed', seconds: x.seconds, rest: x.rest, sets: x.sets ?? 3, reps: x.reps ?? 10, weight: x.weight, group: t.rounds > 1 ? `Round ${r + 1}` : undefined })
      const dur = Math.round(exs.reduce((s, e) => s + (e.mode === 'reps' ? e.sets * (30 + e.rest) : e.seconds + e.rest), 0) / 60)
      setW({ workoutId: 't-' + t.id, title: t.name, discipline: 'strength', duration: dur, exercises: exs })
    })
  }, [isTemplate, id])

  const [steps, setSteps] = useState<Step[]>(() => (w?.exercises?.length ? buildSteps(w.exercises) : []))
  const [idx, setIdx] = useState(0)
  const [segStart, setSegStart] = useState(() => Date.now())
  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(0)
  const [done, setDone] = useState(false)
  const [log, setLog] = useState<Record<number, SetEntry[]>>({})
  const [startedAt, setStartedAt] = useState(() => Date.now())   // wall-clock start (real duration)

  // kg/lbs from the saved units preference; toggleable live during the workout.
  const units = (useLiveQuery(() => getSetting('units')) as string | undefined) ?? 'metric'
  const unit = units === 'imperial' ? 'lb' : 'kg'
  const stills = (useLiveQuery(() => getSetting('exerciseStills')) as string | undefined) === '1'

  // Build steps and resume in-progress position/log/start-time across a refresh.
  useEffect(() => {
    if (!w) return
    setSteps(buildSteps(w.exercises))
    const saved = sessionStorage.getItem('gp:' + w.workoutId)
    if (saved) {
      try { const s = JSON.parse(saved); setIdx(s.idx ?? 0); setLog(s.log ?? {}); setStartedAt(s.startedAt ?? Date.now()); setSegStart(Date.now()); return } catch { /* fall through */ }
    }
    setIdx(0); setSegStart(Date.now()); setStartedAt(Date.now())
    lastLogForWorkout(w.workoutId).then((prev) => { if (prev?.sets) setLog(prev.sets) })
  }, [w])

  useEffect(() => {
    if (w && !done) sessionStorage.setItem('gp:' + w.workoutId, JSON.stringify({ idx, log, startedAt }))
  }, [idx, log, startedAt, w, done])

  const now = useNow(250)
  useWakeLock(true)
  const totalEx = w?.exercises?.length ?? 0
  const cur = steps[idx]
  const isManual = cur?.kind === 'set'
  const elapsed = paused ? pausedAt / 1000 : (now - segStart) / 1000
  const remaining = cur && !isManual ? Math.max(0, (cur as { duration: number }).duration - elapsed) : 0
  const upNext = (() => { for (let j = idx + 1; j < steps.length; j++) { const s = steps[j]; if (s.kind === 'timed' || s.kind === 'set') return s.ex } return null })()

  function jump(to: number) { setIdx(to); setSegStart(Date.now()); setPaused(false); setPausedAt(0) }
  function advance() { if (idx + 1 < steps.length) jump(idx + 1); else finish() }
  // Add an extra set to the CURRENT exercise (insert a rest + new set after its last set).
  function addSet() {
    if (cur?.kind !== 'set') return
    const { exIndex, ex, exNo } = cur
    setSteps((prev) => {
      const newSets = prev.filter((s) => s.kind === 'set' && s.exIndex === exIndex).length + 1
      let lastSetI = -1
      prev.forEach((s, i) => { if (s.kind === 'set' && s.exIndex === exIndex) lastSetI = i })
      if (lastSetI < 0) return prev
      const updated = prev.map((s) => (s.kind === 'set' && s.exIndex === exIndex ? { ...s, sets: newSets } : s))
      const restBetween: Step = { kind: 'rest', duration: ex.rest > 0 ? ex.rest : DEFAULT_REST, next: ex, nextNo: exNo }
      const newSet: Step = { kind: 'set', ex, exNo, exIndex, setNo: newSets, sets: newSets, reps: ex.reps, weight: ex.weight }
      const out = [...updated]; out.splice(lastSetI + 1, 0, restBetween, newSet); return out
    })
  }

  // Time-based auto-advance from ABSOLUTE time, so the timer keeps running while
  // the screen is off and simply catches up on wake (no pause, no drift). useNow
  // ticks every 250ms and the instant the tab becomes visible again.
  useEffect(() => {
    if (!cur || paused || done || isManual) return
    const d = (cur as { duration: number }).duration
    if (now - segStart >= d * 1000) {
      if (idx + 1 < steps.length) { setIdx(idx + 1); setSegStart(segStart + d * 1000) }
      else finish()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, cur, paused, segStart, done, isManual, idx, steps])

  // Countdown cues: short "bip" for the last 5 seconds…
  const lastSec = useRef(-1)
  useEffect(() => {
    if (paused || !cur || done || isManual) return
    const s = Math.ceil(remaining)
    if (s !== lastSec.current) { lastSec.current = s; if (s >= 1 && s <= 5) beep(880, 0.09) }
  }, [remaining, paused, cur, done, isManual, beep])

  // …then a long "biiiip" on the transition to the next step.
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return }
    if (cur && cur.kind !== 'rest') beep(1320, 0.45, 0.32)
    else if (cur) beep(660, 0.45, 0.3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])


  function logSet(exIndex: number, setNo: number, patch: Partial<SetEntry>) {
    setLog((L) => {
      const arr = (L[exIndex] ?? []).slice()
      const prev: SetEntry = arr[setNo - 1] ?? { done: false }
      arr[setNo - 1] = { ...prev, ...patch }
      return { ...L, [exIndex]: arr }
    })
  }

  const [finalMin, setFinalMin] = useState(0)
  async function finish() {
    if (!w) { setDone(true); return }
    const actualMin = Math.max(1, Math.round((Date.now() - startedAt) / 60000))   // REAL elapsed, not the estimate
    setFinalMin(actualMin); setDone(true)
    sessionStorage.removeItem('gp:' + w.workoutId)
    const flat = Object.values(log).flat()
    const setsCompleted = flat.filter((s) => s?.done).length
    const volume = flat.reduce((v, s) => v + (s?.done ? (s.weight || 0) * (s.reps || 0) : 0), 0)
    const tss = gymTSS(actualMin, w.intensity)
    await logWorkout({ workoutId: w.workoutId, title: w.title, discipline: w.discipline, duration: actualMin, date: localISO(), sets: log, setsCompleted, volume, tss })
  }

  if (!w || !cur) return <div className="page-head"><h1>No workout loaded</h1><button className="btn" onClick={() => navigate(-1)}>Back</button></div>

  if (done) return (
    <div className="gp2 gp2--done">
      <div className="gp2-donecard">
        <div style={{ fontSize: 56 }}>🎉</div>
        <h1 style={{ margin: '8px 0 2px' }}>Workout complete</h1>
        <p style={{ color: 'var(--text-dim,#888)' }}>{w.title}</p>
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', width: '100%', marginTop: 16 }}>
          <div className="stat"><div className="v">{totalEx}</div><div className="k">exercises</div></div>
          <div className="stat"><div className="v">{finalMin}</div><div className="k">minutes</div></div>
          <div className="stat"><div className="v">{gymTSS(finalMin, w.intensity)}</div><div className="k">TSS</div></div>
        </div>
        <button className="btn" style={{ marginTop: 20 }} onClick={() => navigate('/progress')}>View progress</button>
        <button className="btn btn--ghost" onClick={() => navigate('/exercises')}>Done</button>
      </div>
    </div>
  )

  const sec = Math.ceil(remaining)
  const showVid = cur.kind === 'timed' || cur.kind === 'set'
  const group = cur.kind === 'timed' || cur.kind === 'set' ? cur.ex.group : undefined
  const name = cur.kind === 'ready' ? (cur.next?.name ?? 'Get ready') : cur.kind === 'rest' ? cur.next.name : cur.ex.name
  const sub = cur.kind === 'timed' ? `Exercise ${cur.exNo} / ${totalEx}`
    : cur.kind === 'set' ? `Set ${cur.setNo} / ${cur.sets} · target ${cur.reps} reps`
    : cur.kind === 'rest' ? `Up next · ${cur.nextNo} / ${totalEx}` : `Starting · ${totalEx} exercises`
  const setEntry = cur.kind === 'set' ? (log[cur.exIndex]?.[cur.setNo - 1]) : undefined
  const prevSet = cur.kind === 'set' ? (log[cur.exIndex]?.[cur.setNo - 2]) : undefined
  // Carry-forward is a PLACEHOLDER suggestion only — it never overrides what you type
  // or clear (that was the "can't delete the weight" bug). Done-set falls back to it.
  const suggestWeight = prevSet?.weight ?? (cur.kind === 'set' ? cur.weight : undefined)
  const suggestReps = prevSet?.reps ?? (cur.kind === 'set' ? cur.reps : undefined)
  const curExNo = cur.kind === 'set' ? cur.exNo : cur.kind === 'timed' ? cur.exNo : cur.kind === 'rest' ? cur.nextNo : 0
  const workoutElapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
  const toggleUnit = () => setSetting('units', units === 'imperial' ? 'metric' : 'imperial')

  return (
    <div className="gp2">
      <div className="gp2-top">
        <button className="gp2-x" onClick={() => { if (confirm('Quit without logging?')) navigate(-1) }}>✕</button>
        <div className="gp2-title">{w.title}<span className="gp2-elapsed">⏱ {clock(workoutElapsed)}</span></div>
        <button className="gp2-finish" onClick={() => { if (confirm('Finish & log this workout now?')) finish() }}>Finish</button>
      </div>

      <div className={'gp2-stage' + (cur.kind === 'rest' ? ' gp2-stage--rest' : '')}>
        {showVid
          ? <StageVideo ex={cur.ex} female={female} stills={stills} />
          : <div className="gp2-restbig">{cur.kind === 'rest' ? 'REST' : 'GET READY'}</div>}
      </div>

      <div className="gp2-info">
        {group && <div className="gp2-group">{group}</div>}
        <h2 className="gp2-name">{name}</h2>
        <div className="gp2-sub">{sub}</div>
      </div>

      {cur.kind === 'set' ? (
        <div className="gp2-logbar">
          <label className="gp2-f">weight<input type="number" inputMode="decimal" value={setEntry?.weight ?? ''} placeholder={suggestWeight != null ? String(suggestWeight) : ''} onChange={(e) => logSet(cur.exIndex, cur.setNo, { weight: e.target.value === '' ? undefined : Number(e.target.value) })} /><button type="button" className="gp2-unit" onClick={toggleUnit} title="kg / lb">{unit}</button></label>
          <span className="gp2-x2">×</span>
          <label className="gp2-f"><input type="number" inputMode="numeric" value={setEntry?.reps ?? ''} placeholder={suggestReps != null ? String(suggestReps) : ''} onChange={(e) => logSet(cur.exIndex, cur.setNo, { reps: e.target.value === '' ? undefined : Number(e.target.value) })} />reps</label>
          <button className="gp2-skip" onClick={advance} title="Skip this set">Skip</button>
          <button className="gp2-done" onClick={() => { logSet(cur.exIndex, cur.setNo, { done: true, weight: setEntry?.weight ?? suggestWeight, reps: setEntry?.reps ?? suggestReps }); advance() }}>Done set →</button>
        </div>
      ) : (
        <div className={'gp2-timer' + (sec <= 3 && showVid ? ' gp2-timer--pulse' : '') + (cur.kind === 'rest' ? ' gp2-timer--rest' : '')}>{clock(remaining)}</div>
      )}

      {cur.kind === 'set' && (
        <div className="gp2-setlist">
          {Array.from({ length: cur.sets }, (_, k) => {
            const sn = k + 1
            const e = log[cur.exIndex]?.[sn - 1]
            const isCur = sn === cur.setNo
            const stepI = steps.findIndex((s) => s.kind === 'set' && s.exIndex === cur.exIndex && s.setNo === sn)
            return (
              <button key={sn} className={'gp2-setrow' + (isCur ? ' cur' : '') + (e?.done ? ' done' : '')} onClick={() => stepI >= 0 && jump(stepI)}>
                <span className="gp2-setn">{e?.done ? '✓' : isCur ? '▸' : sn}</span>
                <span className="gp2-setv">{e?.weight != null ? `${e.weight}${unit}` : '—'} × {e?.reps != null ? e.reps : cur.reps}</span>
              </button>
            )
          })}
          <button className="gp2-setrow gp2-addset" onClick={addSet} title="Add a set">＋ set</button>
        </div>
      )}

      <div className="gp2-dots">
        {w.exercises.map((ex, i) => {
          // Resume at the first NOT-done set of that exercise, not always set 1.
          const undone = steps.findIndex((s) => s.kind === 'set' && s.exNo === i + 1 && !log[i]?.[s.setNo - 1]?.done)
          const target = undone >= 0 ? undone : steps.findIndex((s) => (s.kind === 'timed' || s.kind === 'set') && s.exNo === i + 1)
          return <button key={i} className={'gp2-dot' + (i + 1 < curExNo ? ' on' : '') + (i + 1 === curExNo ? ' cur' : '')} title={ex.name} onClick={() => target >= 0 && jump(target)} />
        })}
      </div>

      {upNext && showVid && (
        <div className="gp2-next">
          <div className="gp2-next-thumb" style={(female && upNext.imageFemale ? upNext.imageFemale : upNext.image) ? { backgroundImage: `url(${female && upNext.imageFemale ? upNext.imageFemale : upNext.image})` } : undefined} />
          <div><div className="gp2-next-k">Up next</div><div className="gp2-next-n">{upNext.name}</div></div>
        </div>
      )}

      <div className="gp2-controls">
        <button className="gp2-ctrl" onClick={() => jump(Math.max(0, idx - 1))}>‹‹</button>
        {!isManual && <button className="gp2-ctrl gp2-ctrl--play" onClick={() => { if (paused) { setSegStart(Date.now() - pausedAt); setPaused(false) } else { setPausedAt(now - segStart); setPaused(true) } }}>{paused ? '▶' : '❚❚'}</button>}
        <button className="gp2-ctrl" onClick={advance}>››</button>
      </div>
    </div>
  )
}
