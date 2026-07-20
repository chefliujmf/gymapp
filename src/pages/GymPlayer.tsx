import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWorkoutsById, allExercisesById } from '../data/catalog'
import { useBeeper, useNow, useWakeLock } from '../hooks'
import { db, getSetting, setSetting, getTemplate, lastLogForWorkout, logWorkout, type SetEntry } from '../db'
import { e1rm, weightForReps, roundLoad, bestE1rmByExercise, reliableSessionMinutes } from '../strength'
import { getGymSession, matchExercise, gymFeedbackKeys } from '../plan'
import { authApi, type CoachReview } from '../auth/api'
import GymSummary from '../GymSummary'
import { localISO } from '../date'
import { gymTSS, type GymIntensity } from '../tss'


interface PlayerEx {
  name: string; exId?: string
  image?: string; video?: string; imageFemale?: string; videoFemale?: string
  mode: 'timed' | 'reps'
  seconds: number; rest: number; sets: number; reps: number; weight?: number
  group?: string
  eachSide?: boolean // #168 unilateral — dose is per side (L + R)
  tempo?: string; tip?: string // #284
}
interface Session { workoutId: string; title: string; discipline: string; duration: number; exercises: PlayerEx[]; intensity?: GymIntensity }

type Step =
  | { kind: 'ready'; duration: number; next?: PlayerEx }
  | { kind: 'timed'; duration: number; ex: PlayerEx; exNo: number; exIndex: number }
  | { kind: 'set'; ex: PlayerEx; exNo: number; exIndex: number; setNo: number; sets: number; reps: number; weight?: number }
  | { kind: 'rest'; duration: number; next: PlayerEx; nextNo: number }

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`

function enrich(name: string, exId: string | undefined, img?: string, vid?: string) {
  const byId = exId ? allExercisesById[exId] : undefined
  // #296: if the pinned entry (or passed media) has no VIDEO, fall back to a video-having match of
  // the same movement so the demo isn't a static image / blank (e.g. an image-only "Bicep Curl").
  const lib = (byId?.video || vid) ? byId : (matchExercise(name) || byId)
  return { name, exId: lib?.id ?? exId, image: lib?.image ?? img, video: lib?.video ?? vid, imageFemale: lib?.imageFemale, videoFemale: lib?.videoFemale }
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
      <video ref={ref} key={video} className="gp2-vid" src={video} poster={image} muted loop playsInline autoPlay controlsList="nodownload" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} />
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
  const [review, setReview] = useState<CoachReview | null>(null) // #285 coach verdict for today's gym (async)
  useEffect(() => { authApi.coachReviews().then((r) => { const t = localISO(); setReview(r.find((x) => x.date === t && (x.sport === 'gym' || !x.sport)) || null) }).catch(() => {}) }, [])
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
    const exs: PlayerEx[] = s.exercises.map((x) => ({ ...enrich(x.name, x.exId, x.image, x.video), mode: x.mode, seconds: x.seconds, rest: x.rest, sets: x.sets, reps: x.reps, group: x.note, eachSide: x.eachSide, tempo: x.tempo, tip: x.tip }))
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
  const [e1rmMap, setE1rmMap] = useState<Map<string, { e1rm: number; date: string }>>(new Map())
  const [pr, setPr] = useState<{ name: string; v: number } | null>(null)
  const [startedAt, setStartedAt] = useState(() => Date.now())   // wall-clock start (real duration)
  const [started, setStarted] = useState(false)                  // false = pre-workout preview (estimate + reorder)
  const [order, setOrder] = useState<PlayerEx[]>([])             // exercise order (reorderable in preview)
  const touchX = useRef(0)                                       // swipe-to-change-exercise

  // kg/lbs from the saved units preference; toggleable live during the workout.
  const units = (useLiveQuery(() => getSetting('units')) as string | undefined) ?? 'metric'
  const unit = units === 'imperial' ? 'lb' : 'kg'
  const stillsPref = (useLiveQuery(() => getSetting('exerciseStills')) as string | undefined) === '1'
  // In-workout override (#53): flip image/video on the fly without leaving the player.
  const [stillsOverride, setStillsOverride] = useState<boolean | null>(null)
  const stills = stillsOverride ?? stillsPref

  // Build steps and resume in-progress position/log/start-time across a refresh.
  useEffect(() => {
    if (!w) return
    setOrder(w.exercises)
    setSteps(buildSteps(w.exercises))
    const saved = sessionStorage.getItem('gpv2:' + w.workoutId)
    if (saved) {
      // resume an in-progress session — skip the preview
      try { const s = JSON.parse(saved); setIdx(s.idx ?? 0); setLog(s.log ?? {}); setStartedAt(s.startedAt ?? Date.now()); setSegStart(Date.now()); setStarted(true); return } catch { /* fall through */ }
    }
    setIdx(0); setSegStart(Date.now()); setStartedAt(Date.now()); setStarted(false)   // fresh -> show preview
    lastLogForWorkout(w.workoutId).then((prev) => { if (prev?.sets) setLog(prev.sets) })
    db.logs.toArray().then((logs) => setE1rmMap(bestE1rmByExercise(logs)))   // for the e1RM → weight prescription
  }, [w])

  // Rough per-exercise time estimate: reps ~3s TUT each + rest; timed = work + rest.
  const estSec = (e: PlayerEx) => e.mode === 'reps' ? e.sets * (e.reps * 3 + (e.rest > 0 ? e.rest : DEFAULT_REST)) : e.seconds + (e.rest > 0 ? e.rest : DEFAULT_REST)
  const estTotalMin = Math.max(1, Math.round(order.reduce((s, e) => s + estSec(e), 0) / 60))
  const moveEx = (i: number, dir: -1 | 1) => setOrder((o) => { const j = i + dir; if (j < 0 || j >= o.length) return o; const n = [...o]; [n[i], n[j]] = [n[j], n[i]]; return n })
  function startWorkout() { setSteps(buildSteps(order)); setIdx(0); setSegStart(Date.now()); setStartedAt(Date.now()); setStarted(true) }

  useEffect(() => {
    // #294: only persist a RESUME snapshot once actually STARTED — otherwise opening the pre-start
    // preview (reorder + insights) and leaving would resume past it on the next open. Key bumped to
    // gpv2 so pre-fix preview snapshots are ignored.
    if (w && started && !done) sessionStorage.setItem('gpv2:' + w.workoutId, JSON.stringify({ idx, log, startedAt }))
  }, [idx, log, startedAt, w, started, done])

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
    const wallMin = Math.max(1, Math.round((Date.now() - startedAt) / 60000))   // wall-clock elapsed (fragile)
    const flat = Object.values(log).flat()
    const setsCompleted = flat.filter((s) => s?.done).length
    const volume = flat.reduce((v, s) => v + (s?.done ? (s.weight || 0) * (s.reps || 0) : 0), 0)
    // #527/#251 — a tab close / reload can reset `startedAt`, logging an impossibly-short time (20 sets in "11 min").
    // Fall back to the PLANNED duration (== what intervals shows) when the wall-clock is implausible for the work done.
    const duration = reliableSessionMinutes({ wallMin, setsCompleted, plannedMin: w.duration })
    setFinalMin(duration); setDone(true)
    sessionStorage.removeItem('gpv2:' + w.workoutId)
    const tss = gymTSS(duration, w.intensity)
    // names in executed order (index-aligned with `log`) so history is readable.
    const exNames = order.map((e) => e.name)
    const exIds = order.map((e) => e.exId)
    await logWorkout({ workoutId: w.workoutId, title: w.title, discipline: w.discipline, duration, date: localISO(), sets: log, setsCompleted, volume, tss, exNames, exIds })
    // Match-first (#123): if a device (Coros) recorded this gym session in intervals, link it
    // — don't duplicate. No stream here, so when nothing matches it just stays in Platyplus
    // (the coach reads the rich set/rep log from Platyplus anyway).
    authApi.completeActivity({ sport: 'gym', title: w.title, date: localISO(), startIso: new Date(startedAt).toISOString(), durationSec: duration * 60, samples: [] }).catch(() => { /* best-effort */ })
  }

  if (!w || !cur) return <div className="page-head"><h1>No workout loaded</h1><button className="btn" onClick={() => navigate(-1)}>Back</button></div>

  // ---- PRE-WORKOUT PREVIEW: estimate + reorder + per-exercise insights, then Start ----
  // #295: suggested working weight (from best recent est 1RM) + est 1RM + last time, so you walk in
  // knowing the numbers. Name-keyed, case-insensitive.
  const e1rmFor = (name: string) => e1rmMap.get(name) || [...e1rmMap.entries()].find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1]
  if (!started && !done) return (
    <div className="gp2">
      <div className="gp2-top">
        <button className="gp2-x" onClick={() => navigate(-1)}>✕</button>
        <div className="gp2-title">{w.title}<span className="gp2-elapsed">~{estTotalMin} min · {order.length} exercises</span></div>
        <div style={{ width: 34 }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 16px' }}>
        <div className="section-title">Plan · reorder with ↑ ↓ · targets from your recent lifts</div>
        <div className="stack" style={{ gap: 8 }}>
          {order.map((ex, i) => {
            const est = ex.mode === 'reps' ? e1rmFor(ex.name) : undefined
            const sug = est ? roundLoad(weightForReps(est.e1rm, ex.reps || 10)) : null
            const lastSets = (log[i] || []).filter((s) => (s.reps || 0) > 0)
            const lastStr = lastSets.length ? lastSets.slice(0, 3).map((s) => `${s.weight ? s.weight + '×' : 'BW×'}${s.reps}`).join(' · ') : null
            return (
            <div key={i} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px' }}>
              <div className="thumb" style={{ width: 42, height: 42, flex: 'none' }}>{ex.image ? <img src={ex.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : '🏋️'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: 0 }}>{ex.name}</h4>
                <div className="meta">{ex.mode === 'reps' ? `${ex.sets}×${ex.reps}` : `${ex.seconds}s`}{ex.eachSide ? ' each side' : ''} · ~{Math.max(1, Math.round(estSec(ex) / 60))} min{ex.tempo ? <span className="tl-tempo"> · tempo {ex.tempo}</span> : ''}</div>
                {(sug || est || lastStr) && (
                  <div className="gp-ins">
                    {sug ? <span className="gp-pill gp-pill--sug">suggested <b>{sug} kg</b></span> : ex.mode === 'reps' ? <span className="gp-pill">log a weight to get a target</span> : null}
                    {est ? <span className="gp-pill">est 1RM <b>{Math.round(est.e1rm)} kg</b></span> : null}
                    {lastStr ? <span className="gp-pill">last <b>{lastStr}</b></span> : null}
                  </div>
                )}
                {ex.tip ? <div className="meta" style={{ whiteSpace: 'normal', color: 'var(--text-dim)', marginTop: 4 }}>💡 {ex.tip}</div> : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button className="entry-kebab" onClick={() => moveEx(i, -1)} disabled={i === 0} title="Up">↑</button>
                <button className="entry-kebab" onClick={() => moveEx(i, 1)} disabled={i === order.length - 1} title="Down">↓</button>
              </div>
            </div>
            )
          })}
        </div>
      </div>
      <button className="btn" style={{ margin: '8px 16px 18px' }} onClick={startWorkout}>▶ Start workout · ~{estTotalMin} min</button>
    </div>
  )

  if (done) {
    // ---- Post-gym summary (#285): unified with the completed-view — CoachVerdict + hero/chips +
    // insight + by-exercise sets/PR + feedback (shared GymSummary, also used by PostWorkout revisit).
    const exLogs = order.map((ex, i) => ({ name: ex.name, exId: ex.exId, sets: log[i] || [] }))
    return (
      <div className="gp2 gp2--done">
        <div className="gp2-sum">
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 52 }}>🎉</div>
            <h1 style={{ margin: '6px 0 2px' }}>Workout complete</h1>
            <p style={{ color: 'var(--text-dim,#888)', margin: 0 }}>{w.title}</p>
          </div>
          {(() => { const fk = gymFeedbackKeys({ date: localISO(), workoutId: w.workoutId }); return <GymSummary minutes={finalMin} exercises={exLogs} review={review} bestE1rm={e1rmMap} feedbackId={fk.id} altFeedbackIds={fk.altIds} feedbackDate={localISO()} /> })()}
          <button className="btn" style={{ marginTop: 18 }} onClick={() => navigate('/progress')}>View progress</button>
          <button className="btn btn--ghost" onClick={() => navigate('/plan')}>Done</button>
        </div>
      </div>
    )
  }

  const sec = Math.ceil(remaining)
  // #591 Option A — the editable JeFit SET GRID. It renders for a reps 'set' step AND for the rest
  // BETWEEN two sets of the same reps exercise (rest becomes a background countdown banner), so logging is
  // one continuous editable grid, never one-set-at-a-time. Timed exercises keep the big countdown timer.
  const gEx = cur.kind === 'set' || cur.kind === 'timed' ? cur.ex : cur.kind === 'rest' ? cur.next : null
  const gExIndex = cur.kind === 'set' ? cur.exIndex : cur.kind === 'rest' ? cur.nextNo - 1 : -1
  const gridShow = cur.kind === 'set' || (cur.kind === 'rest' && cur.next?.mode === 'reps')
  const showVid = cur.kind === 'timed' || cur.kind === 'set' || (cur.kind === 'rest' && cur.next?.mode === 'reps')
  const group = gEx?.group
  const name = cur.kind === 'ready' ? (cur.next?.name ?? 'Get ready') : gEx?.name ?? 'Rest'
  const gSetCount = gExIndex >= 0 ? Math.max(steps.filter((s) => s.kind === 'set' && s.exIndex === gExIndex).length, gEx?.sets || 1, log[gExIndex]?.length || 0) : 0
  const nextSetStep = steps.slice(idx + 1).find((s): s is Extract<Step, { kind: 'set' }> => s.kind === 'set' && s.exIndex === gExIndex)
  const gCurSetNo = cur.kind === 'set' ? cur.setNo : (nextSetStep?.setNo ?? 1)
  const gTargetReps = gEx?.reps ?? 0
  const gE1rm = gEx ? e1rmMap.get(gEx.name)?.e1rm : undefined
  // Suggested weight (PLACEHOLDER only — never overrides what you type/clear): from your est 1RM for the
  // target reps, else the last weight logged this exercise. (#295 carry-forward.)
  const gSuggestW = gE1rm && gTargetReps ? roundLoad(weightForReps(gE1rm, gTargetReps)) : (gExIndex >= 0 ? log[gExIndex]?.find((s) => s?.weight)?.weight : undefined)
  const gDoneCount = gExIndex >= 0 ? (log[gExIndex] || []).filter((s) => s?.done).length : 0
  // Bodyweight (#591 JM): reps-with-no-weight exercises (push-ups, pull-ups). Weight stays OPTIONAL — a set
  // logs done on reps alone — but the field reads "BW" so it doesn't look like a required number. A LOADED
  // variation (coach-planned weight, or a weight you typed) still shows the number so you can log it.
  const gBW = !!gEx?.exId && /bodyweight/i.test(String(allExercisesById[gEx.exId]?.equipment ?? '')) && !gEx?.weight && !(gExIndex >= 0 && (log[gExIndex] || []).some((s) => s?.weight))
  const sub = cur.kind === 'timed' ? `Exercise ${cur.exNo} / ${totalEx}`
    : gridShow && gEx ? `Set ${gCurSetNo} / ${gSetCount} · target ${gTargetReps} reps${gEx.eachSide ? ' each side' : ''}${gEx.tempo ? ` · tempo ${gEx.tempo}` : ''}`
    : cur.kind === 'rest' ? `Up next · ${cur.nextNo} / ${totalEx}` : `Starting · ${totalEx} exercises`
  // Mark/clear a set done (with typed or suggested values) + fire a PR toast when it beats the best e1RM.
  function markSetDone(exIndex: number, setNo: number, exName: string, doneVal: boolean) {
    const e = log[exIndex]?.[setNo - 1]
    const wgt = e?.weight ?? (setNo > 1 ? log[exIndex]?.[setNo - 2]?.weight : undefined) ?? gSuggestW
    const rps = e?.reps ?? gTargetReps
    logSet(exIndex, setNo, { done: doneVal, weight: wgt, reps: rps })
    if (doneVal && wgt && rps) {
      const v = e1rm(wgt, rps), best = e1rmMap.get(exName)?.e1rm || 0
      if (v > best + 0.1) { setPr({ name: exName, v: Math.round(v) }); setE1rmMap((m) => new Map(m).set(exName, { e1rm: v, date: '' })); setTimeout(() => setPr(null), 3800) }
    }
  }
  const curExNo = cur.kind === 'set' ? cur.exNo : cur.kind === 'timed' ? cur.exNo : cur.kind === 'rest' ? cur.nextNo : 0
  const workoutElapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
  const toggleUnit = () => setSetting('units', units === 'imperial' ? 'metric' : 'imperial')
  // Swipe the stage left/right to jump to the next/previous exercise (first un-done set).
  const swipeEx = (dir: -1 | 1) => {
    const t = (curExNo - 1) + dir
    if (t < 0 || t >= w.exercises.length) return
    const undone = steps.findIndex((s) => s.kind === 'set' && s.exNo === t + 1 && !log[t]?.[s.setNo - 1]?.done)
    const i = undone >= 0 ? undone : steps.findIndex((s) => (s.kind === 'timed' || s.kind === 'set') && s.exNo === t + 1)
    if (i >= 0) jump(i)
  }

  return (
    <div className="gp2">
      <div className="gp2-top">
        <button className="gp2-x" onClick={() => { if (confirm('Quit without logging?')) navigate(-1) }}>✕</button>
        <div className="gp2-title">{w.title}<span className="gp2-elapsed">⏱ {clock(workoutElapsed)}</span></div>
        <button className="gp2-finish" onClick={() => { if (confirm('Finish & log this workout now?')) finish() }}>Finish</button>
      </div>

      <div className={'gp2-stage' + (cur.kind === 'rest' ? ' gp2-stage--rest' : '')}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 60) swipeEx(dx < 0 ? 1 : -1) }}>
        {showVid && gEx
          ? <StageVideo ex={gEx} female={female} stills={stills} />
          : <div className="gp2-restbig">{cur.kind === 'rest' ? 'REST' : 'GET READY'}</div>}
        {showVid && gEx && (gEx.video || gEx.image) && (
          <button className="gp2-demotoggle" onClick={(e) => { e.stopPropagation(); setStillsOverride(!stills) }} title="Switch demo image/video">
            {stills ? '▶ Video' : '🖼 Still'}
          </button>
        )}
      </div>

      <div className="gp2-info">
        {group && <div className="gp2-group">{group}</div>}
        <h2 className="gp2-name">{name}{gE1rm ? <span className="gp2-1rm">1RM {Math.round(gE1rm)}{unit}</span> : null}</h2>
        <div className="gp2-sub">{sub}</div>
        {/* #255 — the per-exercise coach insight DURING the set (was only in the pre-workout preview). */}
        {gEx?.tip && (gridShow || cur.kind === 'timed') && <div className="gp2-tip">💡 {gEx.tip}</div>}
      </div>

      {gridShow && gEx ? (
        /* #591 Option A — editable set grid: tap any weight/reps to fix it (even mid-workout), tap ✓ to log
           a set. Rest between sets shows as a banner so the grid stays put. */
        <div className="gp2-gridwrap">
          {cur.kind === 'rest' && <div className="gp2-restbanner">⏱ Rest {clock(remaining)}<button className="gp2-restskip" onClick={advance}>skip →</button></div>}
          <div className="gp2-grid">
            {Array.from({ length: gSetCount }, (_, k) => {
              const sn = k + 1
              const e = log[gExIndex]?.[sn - 1]
              const isCur = cur.kind === 'set' && sn === gCurSetNo
              return (
                <div key={sn} className={'gp2-grow' + (isCur ? ' cur' : '') + (e?.done ? ' done' : '')}>
                  <span className="gp2-gn">{sn}</span>
                  {gBW && e?.weight == null
                    ? <span className="gp2-gbw">bodyweight</span>
                    : <><label className="gp2-gf"><input type="number" inputMode="decimal" value={e?.weight ?? ''} placeholder={gSuggestW != null ? String(gSuggestW) : ''} onChange={(ev) => logSet(gExIndex, sn, { weight: ev.target.value === '' ? undefined : Number(ev.target.value) })} /><button type="button" className="gp2-gu gp2-gu--btn" onClick={toggleUnit} title="kg / lb">{unit}</button></label><span className="gp2-gx">×</span></>}
                  <label className="gp2-gf"><input type="number" inputMode="numeric" value={e?.reps ?? ''} placeholder={gTargetReps ? String(gTargetReps) : ''} onChange={(ev) => logSet(gExIndex, sn, { reps: ev.target.value === '' ? undefined : Number(ev.target.value) })} /><span className="gp2-gu">reps</span></label>
                  <button className={'gp2-gck' + (e?.done ? ' on' : '')} onClick={() => markSetDone(gExIndex, sn, gEx.name, !e?.done)} title={e?.done ? 'Logged — tap to undo' : 'Log this set'}>✓</button>
                </div>
              )
            })}
            {cur.kind === 'set' && <button className="gp2-grow gp2-addset" onClick={addSet} title="Add a set">＋ add set</button>}
          </div>
          {pr && <div className="gp2-pr">🎉 New 1RM! {pr.name} · {pr.v}{unit}</div>}
          {cur.kind === 'set' && (
            <div className="gp2-gridcta">
              <button className="gp2-skip" onClick={advance} title="Skip to next">{gDoneCount >= gSetCount ? 'Next →' : 'Skip'}</button>
              <button className="gp2-done" onClick={() => { markSetDone(gExIndex, gCurSetNo, gEx.name, true); advance() }}>Log Set {gCurSetNo}</button>
            </div>
          )}
        </div>
      ) : (
        <div className={'gp2-timer' + (sec <= 3 && showVid ? ' gp2-timer--pulse' : '') + (cur.kind === 'rest' ? ' gp2-timer--rest' : '')}>{clock(remaining)}</div>
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
