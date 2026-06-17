import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWorkoutsById, allExercisesById } from '../data/catalog'
import { useBeeper, useNow, useWakeLock } from '../hooks'
import { getSetting, getTemplate, lastLogForWorkout, logWorkout, type SetEntry } from '../db'
import { getGymSession } from '../plan'

const READY = 10

interface PlayerEx {
  name: string; exId?: string
  image?: string; video?: string; imageFemale?: string; videoFemale?: string
  mode: 'timed' | 'reps'
  seconds: number; rest: number; sets: number; reps: number; weight?: number
  group?: string
}
interface Session { workoutId: string; title: string; discipline: string; duration: number; exercises: PlayerEx[] }

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

function buildSteps(exs: PlayerEx[]): Step[] {
  const steps: Step[] = [{ kind: 'ready', duration: READY, next: exs[0] }]
  exs.forEach((ex, i) => {
    if (ex.mode === 'reps') {
      const sets = Math.max(1, ex.sets)
      for (let s = 1; s <= sets; s++) {
        steps.push({ kind: 'set', ex, exNo: i + 1, exIndex: i, setNo: s, sets, reps: ex.reps, weight: ex.weight })
        const last = i === exs.length - 1 && s === sets
        if (ex.rest > 0 && !last) steps.push({ kind: 'rest', duration: ex.rest, next: s < sets ? ex : exs[i + 1], nextNo: s < sets ? i + 1 : i + 2 })
      }
    } else {
      steps.push({ kind: 'timed', duration: ex.seconds, ex, exNo: i + 1, exIndex: i })
      if (ex.rest > 0 && i < exs.length - 1) steps.push({ kind: 'rest', duration: ex.rest, next: exs[i + 1], nextNo: i + 2 })
    }
  })
  return steps
}

function StageVideo({ ex, female }: { ex: PlayerEx; female: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const video = female && ex.videoFemale ? ex.videoFemale : ex.video
  const image = female && ex.imageFemale ? ex.imageFemale : ex.image
  useEffect(() => { ref.current?.play().catch(() => {}) }, [video])
  if (video) return <video ref={ref} key={video} className="gp2-vid" src={video} poster={image} muted loop playsInline autoPlay />
  if (image) return <img className="gp2-vid" src={image} alt={ex.name} />
  return <div className="gp2-vid" />
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
    setW({ workoutId: s.workoutId, title: s.title, discipline: 'strength', duration: dur, exercises: exs })
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

  useEffect(() => {
    if (!w) return
    setSteps(buildSteps(w.exercises)); setIdx(0); setSegStart(Date.now())
    lastLogForWorkout(w.workoutId).then((prev) => { if (prev?.sets) setLog(prev.sets) })
  }, [w])

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

  useEffect(() => {
    if (!cur || paused || done || isManual) return
    const d = (cur as { duration: number }).duration
    const t = setTimeout(advance, Math.max(0, d * 1000 - (Date.now() - segStart)))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused, segStart, done, isManual])

  const lastSec = useRef(-1)
  useEffect(() => {
    if (paused || !cur || done || isManual) return
    const s = Math.ceil(remaining)
    if (s !== lastSec.current) { lastSec.current = s; if (s >= 1 && s <= 3) beep(880, 0.08) }
  }, [remaining, paused, cur, done, isManual, beep])

  function logSet(exIndex: number, setNo: number, patch: Partial<SetEntry>) {
    setLog((L) => {
      const arr = (L[exIndex] ?? []).slice()
      const prev: SetEntry = arr[setNo - 1] ?? { done: false }
      arr[setNo - 1] = { ...prev, ...patch }
      return { ...L, [exIndex]: arr }
    })
  }

  async function finish() {
    setDone(true)
    if (!w) return
    const flat = Object.values(log).flat()
    const setsCompleted = flat.filter((s) => s?.done).length
    const volume = flat.reduce((v, s) => v + (s?.done ? (s.weight || 0) * (s.reps || 0) : 0), 0)
    await logWorkout({ workoutId: w.workoutId, title: w.title, discipline: w.discipline, duration: w.duration, date: new Date().toISOString().slice(0, 10), sets: log, setsCompleted, volume })
  }

  if (!w || !cur) return <div className="page-head"><h1>No workout loaded</h1><button className="btn" onClick={() => navigate(-1)}>Back</button></div>

  if (done) return (
    <div className="gp2 gp2--done">
      <div className="gp2-donecard">
        <div style={{ fontSize: 56 }}>🎉</div>
        <h1 style={{ margin: '8px 0 2px' }}>Workout complete</h1>
        <p style={{ color: 'var(--text-dim,#888)' }}>{w.title}</p>
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', width: '100%', marginTop: 16 }}>
          <div className="stat"><div className="v">{totalEx}</div><div className="k">exercises</div></div>
          <div className="stat"><div className="v">{w.duration}</div><div className="k">minutes</div></div>
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
  const doneCount = cur.kind === 'set' ? cur.exNo - 1 : cur.kind === 'timed' ? cur.exNo : cur.kind === 'rest' ? cur.nextNo - 1 : 0

  return (
    <div className="gp2">
      <div className="gp2-top">
        <button className="gp2-x" onClick={() => { if (confirm('Stop the workout?')) navigate(-1) }}>✕</button>
        <div className="gp2-title">{w.title}</div>
        <div style={{ width: 34 }} />
      </div>

      <div className={'gp2-stage' + (cur.kind === 'rest' ? ' gp2-stage--rest' : '')}>
        {showVid
          ? <StageVideo ex={cur.ex} female={female} />
          : <div className="gp2-restbig">{cur.kind === 'rest' ? 'REST' : 'GET READY'}</div>}
      </div>

      <div className="gp2-info">
        {group && <div className="gp2-group">{group}</div>}
        <h2 className="gp2-name">{name}</h2>
        <div className="gp2-sub">{sub}</div>
      </div>

      {cur.kind === 'set' ? (
        <div className="gp2-logbar">
          <label className="gp2-f">weight<input type="number" inputMode="decimal" value={setEntry?.weight ?? cur.weight ?? ''} onChange={(e) => logSet(cur.exIndex, cur.setNo, { weight: e.target.value === '' ? undefined : Number(e.target.value) })} />kg</label>
          <span className="gp2-x2">×</span>
          <label className="gp2-f"><input type="number" inputMode="numeric" value={setEntry?.reps ?? cur.reps ?? ''} onChange={(e) => logSet(cur.exIndex, cur.setNo, { reps: e.target.value === '' ? undefined : Number(e.target.value) })} />reps</label>
          <button className="gp2-done" onClick={() => { logSet(cur.exIndex, cur.setNo, { done: true }); advance() }}>Done set →</button>
        </div>
      ) : (
        <div className={'gp2-timer' + (sec <= 3 && showVid ? ' gp2-timer--pulse' : '') + (cur.kind === 'rest' ? ' gp2-timer--rest' : '')}>{clock(remaining)}</div>
      )}

      <div className="gp2-dots">
        {w.exercises.map((_, i) => <span key={i} className={i < doneCount ? 'on' : ''} />)}
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
