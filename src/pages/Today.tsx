import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, listTemplates, listRideTemplates, type WorkoutTemplate, type RideTemplate } from '../db'
import { WeekStrip, MiniProfile, DoneStats } from '../ui'
import { fetchEvents, deleteEvent, eventObjective, sportOf, flattenIcuSteps, fetchActivities, sportOfActivity, type IcuEvent, type IcuActivity } from '../intervals'
import { setPlanEvents, fetchGymPlans, syncIcuPlans, gymSessionFromPlan, setGymSession, setCoachPlans, type CoachPlan } from '../plan'
import { setCurrentRide } from '../ride'
import { calApi, type CalItem } from '../calendar'
import { recipes, mindSessions } from '../data/catalog'
import type { Recipe } from '../types'
import { localISO } from '../date'
import { Bike, Dumbbell, Footprints, Target, Salad, Brain, StickyNote, Plus, Check, Flag, Trash2 } from 'lucide-react'
import { EntryMenu } from '../EntryMenu'
import { AddSheet } from './AddSheet'
import { authApi, type Checkin, type Readiness } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { InfoDot } from '../charts'

// Obvious + funny 1–5 faces (wrecked → amazing). One set for every metric since
// all now read higher = better.
const CHECKIN_FACES = ['💀', '😩', '😐', '😀', '🤩']

/** Quick "how do you feel" check-in (energy/sleep/soreness) — a few taps, feeds the coach. */
function CheckInCard({ day, onChange }: { day: string; onChange?: (ci: Checkin | null) => void }) {
  const isToday = day === localISO()
  const [ci, setCi] = useState<Checkin | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setLoaded(false); authApi.checkins(day, day).then((a) => setCi(a[0] || null)).catch(() => {}).finally(() => setLoaded(true)) }, [day])
  useEffect(() => { onChange?.(ci) }, [ci]) // keep the parent (readiness verdict banner) in sync
  const set = (patch: Partial<Checkin>) => {
    const next = { ...(ci || { date: day }), ...patch } as Checkin
    setCi(next)
    // #207 Phase 2b: stamp the auto scores shown (display terms) so the model learns our overrides.
    const auto = (calc.energy != null || calc.sleep != null || calc.soreness != null)
      ? { energy: calc.energy, sleep: calc.sleep, freshness: calc.soreness != null ? 6 - calc.soreness : undefined }
      : undefined
    authApi.checkin(auto ? { ...next, auto } : next).catch(() => {})
  }
  const [editing, setEditing] = useState(false)
  // #195: auto-derive Sleep·Freshness·Energy (1–5) from intervals wellness + personal baselines
  // (server/readiness.js, WHOOP-inspired). Each unanswered row prefills from data + an ⓘ "why";
  // tapping a face overrides. Energy is null on cold start → stays a manual tap. #74 chips below.
  const [rdy, setRdy] = useState<Readiness | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  // #223: only the CURRENT day gets a live readiness derivation. Past days show what was LOGGED
  // (no auto-derive); future days never mount this card (they show a forecast instead).
  useEffect(() => { let live = true; setRdy(null); setTouched(new Set()); if (isToday) authApi.readiness(day).then((r) => { if (live) setRdy(r) }).catch(() => {}); return () => { live = false } }, [day, isToday])
  // #206: overnight HRV/sleep lands in intervals HOURS late (Coros→intervals lag), so a morning
  // check shows none yet. Re-pull on app focus + a manual ⟳ so a later sync appears without a reload.
  const [refreshing, setRefreshing] = useState(false)
  const refreshRdy = () => { if (!isToday) return; setRefreshing(true); authApi.readiness(day).then(setRdy).catch(() => {}).finally(() => setRefreshing(false)) }
  useEffect(() => {
    if (!isToday) return
    const onVis = () => { if (document.visibilityState === 'visible') authApi.readiness(day).then(setRdy).catch(() => {}) }
    window.addEventListener('focus', onVis); document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('focus', onVis); document.removeEventListener('visibilitychange', onVis) }
  }, [day, isToday])
  // Per-day "why" for the ⓘ — the ACTUAL inputs behind THIS day's score (computed from the
  // wellness data whether or not the row is answered), + the value the data suggests.
  const sgn = (z?: number | null) => (z == null ? '?' : (z > 0 ? '+' : '') + z + 'σ')
  const why: Partial<Record<'energy' | 'sleep' | 'soreness', string>> = {}
  const calc: Partial<Record<'energy' | 'sleep' | 'soreness', number>> = {}
  if (rdy?.connected) {
    if (rdy.sleep) { calc.sleep = Math.round(rdy.sleep.score); why.sleep = rdy.sleep.sleepScore != null ? `your tracker scored this night ${rdy.sleep.sleepScore}/100` : `${rdy.sleep.sleepHours ?? '—'}h slept vs your ~${rdy.sleepNeed}h need` }
    if (rdy.energy) { calc.energy = Math.round(rdy.energy.score); why.energy = `HRV ${sgn(rdy.energy.hrvZ)} vs your baseline, sleep ${rdy.sleep?.score ?? '—'}/5, resting HR ${sgn(rdy.energy.rhrZ)}${rdy.energy.guard ? ' (HRV high but RHR raised → eased)' : ''}` }
    if (rdy.freshness) { calc.soreness = 6 - Math.round(rdy.freshness.score); const pz = rdy.freshness.personalZ; const vsYou = pz == null ? '' : `, ${pz < -0.5 ? 'more loaded than your usual' : pz > 0.5 ? 'fresher than your usual' : 'about your usual'}`; why.soreness = `training load — Form ${rdy.freshness.tsb ?? '—'}, acute-vs-chronic ${rdy.freshness.acwr ?? '—'}${vsYou}` }
  }
  // Auto-fill any UNANSWERED row from the data-derived value; tapping a face overrides.
  useEffect(() => {
    if (!loaded || !rdy?.connected) return
    const fill: Partial<Checkin> = {}
    for (const k of ['energy', 'sleep', 'soreness'] as const) if (ci?.[k] == null && calc[k] != null) fill[k] = calc[k]
    if (Object.keys(fill).length) set(fill)
  }, [loaded, rdy]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!loaded) return null
  // Emoji faces, 1–5, ALWAYS visible (JM: must not be hidden or it gets skipped).
  // Consistent direction: best feeling is always the RIGHT face. Soreness is shown
  // as "Freshness" (5 = fresh) so it reads like the others; `invert` converts to the
  // stored soreness value (5 = very sore) the coach reads — display flips, scale doesn't.
  const rows: { key: 'energy' | 'sleep' | 'soreness'; label: string; desc: string; scale: string; invert?: boolean }[] = [
    { key: 'energy', label: 'Energy', desc: 'How ready your body is to train right now', scale: '1 = wiped out · 5 = full of energy' },
    { key: 'sleep', label: 'Sleep', desc: 'How well last night recovered you', scale: '1 = terrible · 5 = perfect rest' },
    { key: 'soreness', label: 'Freshness', desc: 'How recovered you are from training load', scale: '1 = wrecked / very sore · 5 = fresh & recovered', invert: true },
  ]
  // ⓘ text: the per-day WHY (today's actual inputs) on top, then the scale. Falls back to a
  // clear "no data yet" note so the ⓘ is never just a definition.
  const disp = (r: typeof rows[number]) => { const v = ci?.[r.key]; return v == null ? null : (r.invert ? 6 - v : v) }
  // The auto value RECORDED when this check-in was shown (display terms; #207 Phase 2b stores ci.auto
  // as {energy,sleep,freshness}). Compare against THIS, not the live recompute — otherwise a later
  // drift in the model (calibration / recalibration / new wellness data) falsely reads as "edited".
  const autoDisp = (r: typeof rows[number]) => { const a = ci?.auto; if (!a) return null; const v = r.key === 'soreness' ? a.freshness : a[r.key]; return v ?? null }
  const overridden = (r: typeof rows[number]) => { const a = autoDisp(r), s = disp(r); return a != null && s != null && a !== s }
  // #207 Phase 2b: the learned personal-calibration offset for this row (Freshness lives on 'soreness').
  const calOff = (r: typeof rows[number]) => rdy?.calibration?.[r.key === 'soreness' ? 'freshness' : r.key] ?? 0
  const infoFor = (r: typeof rows[number]) => {
    const head = why[r.key]
      ? `Why ${isToday ? 'today' : 'this day'}: ${why[r.key]}.`
      : `No HRV/sleep synced for ${isToday ? 'today' : 'this day'} yet — this is your own read.`
    const delta = overridden(r) ? `\n\nAuto computed ${autoDisp(r)} · you set ${disp(r)}.` : ''
    const off = calOff(r)
    const tuned = off ? `\n\nTuned to you: nudged ${off > 0 ? '+' : ''}${off} because you've consistently rated this ${off > 0 ? 'higher' : 'lower'} than the model.` : ''
    return `${head}${delta}${tuned}\n\n${r.scale}.`
  }
  // "· auto" while the shown value still equals the auto value RECORDED when filled (untouched).
  const isAuto = (r: typeof rows[number]) => !touched.has(r.key) && autoDisp(r) != null && disp(r) === autoDisp(r)
  // Collapse to a one-line summary ONCE all 3 are logged (collapse-after-done is fine —
  // it's collapse-before-filling that gets skipped). Tap Edit to change; History → Logs.
  const verdict = readinessVerdict(ci)
  const vLabel = verdict ? (verdict.tone === 'good' ? 'Fresh' : verdict.tone === 'low' ? 'Run-down' : 'Moderate') : ''
  if (rows.every((r) => ci?.[r.key] != null) && !editing) {
    return (
      <div className="card checkin checkin--mini">
        <div className="checkin__mhead">
          <span className="checkin__done">✓ Checked in{isToday ? ' today' : ''}{verdict && <span className={'checkin__verdict checkin__verdict--' + verdict.tone}><span className="checkin__vdot" />{vLabel}</span>}</span>
          <button className="checkin__edit" style={{ flex: 'none' }} onClick={() => setEditing(true)}>Edit</button>
        </div>
        <div className="checkin__chips">
          {rows.map((r) => { const v = disp(r) as number; const a = autoDisp(r); const over = overridden(r); return (
            <span key={r.key} className={`mchip mchip--${r.key}${over ? ' mchip--over' : ''}`}>{CHECKIN_FACES[v - 1]} {r.label} {v}{over && <span className="mchip__auto"> · edited (auto {a})</span>} <InfoDot text={infoFor(r)} /></span>
          ) })}
        </div>
        {verdict && (
          <div className="checkin__coach">💬 Your coach has today's check-in<Link to="/chat" className="checkin__coachbtn">Ask coach ↗</Link></div>
        )}
      </div>
    )
  }
  return (
    <div className="card checkin checkin--tight">
      <div className="checkin__t" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>How {isToday ? 'do' : 'did'} you feel{isToday ? ' today' : ''}?{editing && <button className="checkin__edit" onClick={() => setEditing(false)}>Done ✓</button>}</div>
      {rows.map((r) => (
        <div key={r.key} className="checkin__row2">
          <span className="checkin__lbl">{r.label} <InfoDot text={infoFor(r)} />{isAuto(r) ? <span className="checkin__src"> · auto</span> : overridden(r) ? <span className="checkin__src checkin__src--edit"> · edited <span className="checkin__autowas">(auto {autoDisp(r)})</span></span> : null}{calOff(r) ? <span className="checkin__tuned" title="Personalised from your past ratings"> · tuned to you</span> : null}<span className="checkin__desc">{r.desc}</span></span>
          <div className="checkin__faces">
            {[1, 2, 3, 4, 5].map((n) => {
              const stored = r.invert ? 6 - n : n, on = ci?.[r.key] === stored
              return <button key={n} className={'checkin__face' + (on ? ' on' : '')} aria-label={`${r.label} ${n} of 5`} aria-pressed={on} onClick={() => { setTouched((t) => new Set(t).add(r.key)); set({ [r.key]: stored }) }}>{CHECKIN_FACES[n - 1]}</button>
            })}
          </div>
        </div>
      ))}
      {isToday && rdy?.connected && (
        <div className="checkin__wchips">
          {rdy.today?.sleepHours != null && <span className="wchip">😴 {rdy.today.sleepHours}h</span>}
          {rdy.today?.hrv != null && <span className="wchip">HRV {Math.round(rdy.today.hrv)}</span>}
          {rdy.today?.restingHR != null && <span className="wchip">Rest HR {Math.round(rdy.today.restingHR)}</span>}
          {(rdy.today?.hrv != null || rdy.today?.restingHR != null || rdy.today?.sleepHours != null)
            ? <span className="wchip wchip--src" title="These values come from intervals.icu"><span className="wchip__up" aria-hidden="true">↑</span> intervals</span>
            : <span className="wchip wchip--wait">HRV/sleep not synced yet</span>}
          <button className="wchip wchip--refresh" onClick={refreshRdy} disabled={refreshing} title="Re-check intervals for a newer Coros sync">{refreshing ? '…' : '⟳'}</button>
        </div>
      )}
    </div>
  )
}

// #223 — FUTURE day: no check-in / no live verdict (you can't know how you'll feel). Show an
// EXPECTED freshness forecast projected from planned load. Only Freshness is forecastable;
// Energy & Sleep fill in from that day's check-in.
const FORECAST_FACES = ['💀', '😖', '😐', '🙂', '😎']
const freshLabel = (s: number) => s >= 4.3 ? 'Likely fresh' : s >= 3.4 ? 'Likely fresh enough' : s >= 2.5 ? 'Moderately recovered' : s >= 1.6 ? 'Likely fatigued' : 'Likely wrecked'
function ForecastCard({ day, fmtDay }: { day: string; fmtDay: (s: string) => string }) {
  const [f, setF] = useState<Awaited<ReturnType<typeof authApi.readinessForecast>> | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { let live = true; setF(null); setLoaded(false); authApi.readinessForecast(day).then((r) => { if (live) setF(r) }).catch(() => {}).finally(() => { if (live) setLoaded(true) }); return () => { live = false } }, [day])
  if (!loaded) return null
  if (!f?.connected) return <div className="card forecast forecast--muted">📊 Connect intervals.icu to forecast how recovered you'll be on {fmtDay(day)}.</div>
  if (!f.available || f.freshness == null) return <div className="card forecast forecast--muted">📊 Not enough training data yet to forecast {fmtDay(day)}.</div>
  const s = f.freshness
  const load = f.totalPlannedLoad || 0
  const why = load > 0
    ? `${load} TSS planned between now and then${(f.plannedDays || 0) > 0 ? ` across ${f.plannedDays} session${f.plannedDays! > 1 ? 's' : ''}` : ''} — projected Form ${f.form! > 0 ? '+' : ''}${f.form}.`
    : `No hard sessions planned before then, so you should recover — projected Form ${f.form! > 0 ? '+' : ''}${f.form}.`
  return (
    <div className="card forecast">
      <div className="forecast__h">📊 Expected · {fmtDay(day)} · forecast</div>
      <div className="forecast__big">
        <span className="forecast__face">{FORECAST_FACES[Math.round(s) - 1]}</span>
        <div><div className="forecast__lbl">{freshLabel(s)}</div><div className="forecast__sub">Projected Freshness ~{Math.round(s)}/5 · Form {f.form! > 0 ? '+' : ''}{f.form}</div></div>
      </div>
      <div className="forecast__note"><b>Why:</b> {why}</div>
    </div>
  )
}

// Stable daily pick: same item all day, rotates with the date (+salt for variety).
function pickByDate<T>(arr: T[], dateStr: string, salt = 0): T | undefined {
  if (!arr.length) return undefined
  let h = salt >>> 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  return arr[h % arr.length]
}

const planIcon = (s: CoachPlan['sport']) => (s === 'ride' ? <Bike strokeWidth={1.75} /> : s === 'run' ? <Footprints strokeWidth={1.75} /> : <Dumbbell strokeWidth={1.75} />)

// #202: a plain-language readiness verdict from the day's check-in (Energy/Sleep/Freshness,
// each 1–5; Freshness = 6 − soreness). Drives the banner on the plan. Null until checked in.
function readinessVerdict(ci: Checkin | null): { tone: 'good' | 'mixed' | 'low'; text: string } | null {
  if (!ci) return null
  const fresh = ci.soreness != null ? 6 - ci.soreness : null
  const vals = [ci.energy, ci.sleep, fresh].filter((x): x is number => x != null)
  if (!vals.length) return null
  const min = Math.min(...vals), avg = vals.reduce((a, b) => a + b, 0) / vals.length
  if (min <= 2 || avg < 2.8) return { tone: 'low', text: 'A bit run-down — keep it easy and listen to your body today.' }
  if (avg >= 3.8 && min >= 3) return { tone: 'good', text: "You're fresh — good to train as planned." }
  return { tone: 'mixed', text: 'Moderately ready — train, but be ready to ease off.' }
}
const RECOVERY_EMOJI: Record<string, string> = { sauna: '🔥', cold: '🧊', massage: '💆', mobility: '🧎', foam: '🪵', walk: '🚶' }

/** A coach-pushed plan that isn't mirrored by an intervals event — runs in-app. */
function CoachPlanCard({ p, showDate, fmtDay, onSwap, onRemove, done, act }: { p: CoachPlan; onRun?: (p: CoachPlan) => void; showDate?: boolean; fmtDay: (s: string) => string; onSwap?: () => void; onRemove?: () => void; done?: boolean; act?: IcuActivity }) {
  const nav = useNavigate()
  const mins = p.sport === 'gym' ? undefined : Math.round((p.segments || []).reduce((s, x) => s + x.duration, 0) / 60)
  const segs = (p.sport === 'ride' || p.sport === 'run') ? (p.segments || []) : []
  const isDone = done || !!act
  return (
    <div className="today-entry">
      <button className={'card' + (isDone ? ' card--done' : '')} style={{ textAlign: 'left', width: '100%' }} onClick={() => nav('/coach/' + p.id)}>
        <div className="card-row">
          {segs.length
            ? <div className="thumb"><MiniProfile segs={segs} /></div>
            : <div className={'thumb thumb--' + (p.sport === 'ride' ? 'ride' : p.sport === 'run' ? 'run' : 'gym')}>{planIcon(p.sport)}</div>}
          <div className="card-body">
            <span className="eyebrow">{p.sport === 'ride' ? 'Ride' : p.sport === 'run' ? 'Run' : 'Gym'} · in-app{showDate ? ` · ${fmtDay(p.date)}` : ''}</span>
            <h3 style={isDone ? { opacity: 0.6 } : undefined}>{p.title}</h3>
            {p.notes && <div className="plan-desc">{p.notes}</div>}
            {act ? <DoneStats a={act} /> : <div className="meta">{mins ? <span>{mins} min</span> : <span>{(p.exercises || []).length} exercises{p.rounds && p.rounds > 1 ? ` · ${p.rounds} rounds` : ''}</span>}{!done && <span className="dot">▶ start</span>}</div>}
          </div>
        </div>
      </button>
      {isDone && <span className="done-badge">✓ Completed</span>}
      {onSwap && onRemove && <EntryMenu title={p.title} onSubstitute={onSwap} onRemove={onRemove} />}
    </div>
  )
}

const iso = localISO
const todayISO = () => localISO()
function weekRange(): [string, string] {
  // Wide window so the WeekStrip ‹ › navigation (past/future weeks) has data loaded.
  const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 21)
  const end = new Date(mon); end.setDate(mon.getDate() + 70)
  return [iso(mon), iso(end)]
}
const sportIcon = (e: IcuEvent) => { const s = sportOf(e); return s === 'cycling' ? <Bike strokeWidth={1.75} /> : s === 'gym' ? <Dumbbell strokeWidth={1.75} /> : e.type === 'Run' ? <Footprints strokeWidth={1.75} /> : <Target strokeWidth={1.75} /> }
const fmtDay = (s: string) => new Date(s + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

function PlanCard({ e, showDate, onSwap, onRemove, done, act }: { e: IcuEvent; showDate?: boolean; onSwap?: () => void; onRemove?: () => void; done?: boolean; act?: IcuActivity }) {
  const obj = eventObjective(e)
  const mins = e.moving_time ? Math.round(e.moving_time / 60) : undefined
  const isDone = done || !!act
  // ATP phase markers from intervals.icu aren't actual workouts — show them as a plan note.
  const atp = /^ATP\b/i.test(e.name) || e.category === 'NOTE'
  // For structured rides/runs, the thumb shows the workout's power profile, not a generic icon.
  const rideSegs = !atp && (sportOf(e) === 'cycling' || e.type === 'Run') ? flattenIcuSteps(e.workout_doc?.steps) : []
  return (
    <div className="today-entry">
      <Link to={`/plan/${e.id}`} className={'card' + (isDone ? ' card--done' : '')}>
        <div className="card-row">
          {rideSegs.length
            ? <div className="thumb"><MiniProfile segs={rideSegs} /></div>
            : <div className={'thumb thumb--' + (atp ? 'target' : e.category === 'TARGET' ? 'target' : sportOf(e) === 'gym' ? 'gym' : sportOf(e) === 'cycling' ? 'ride' : 'run')}>{atp ? <Flag strokeWidth={1.75} /> : sportIcon(e)}</div>}
          <div className="card-body">
            <span className="eyebrow">{atp ? 'Training block' : e.category === 'TARGET' ? 'Target' : sportOf(e) === 'gym' ? 'Gym' : sportOf(e) === 'cycling' ? 'Ride' : e.type}{showDate ? ` · ${fmtDay(e.start_date_local.slice(0, 10))}` : ''}</span>
            <h3 style={isDone ? { opacity: 0.6 } : undefined}>{e.name}</h3>
            {obj && <div className="plan-desc">{obj}</div>}
            {act ? <DoneStats a={act} /> : mins ? <div className="meta"><span>{mins} min</span>{e.icu_training_load ? <span className="dot">{e.icu_training_load} TSS</span> : null}</div> : null}
          </div>
        </div>
      </Link>
      {isDone && <span className="done-badge">✓ Completed</span>}
      {onSwap && onRemove && <EntryMenu title={e.name} onSubstitute={onSwap} onRemove={onRemove} />}
    </div>
  )
}

/** An assigned meal / mind / note item on the day — editable like everything else. */
function ItemCard({ it, onSwap, onRemove }: { it: CalItem; onSwap: () => void; onRemove: () => void }) {
  const label = it.type === 'meal' ? 'Meal' : it.type === 'mind' ? 'Mind' : 'Note'
  const sub = it.type === 'meal' ? `${it.mealType || 'meal'}${it.kcal ? ` · ${it.kcal} kcal` : ''}` : it.type === 'mind' ? (it.minutes ? `${it.minutes} min` : 'session') : (it.notes || 'note')
  const icon = it.type === 'meal' ? <Salad strokeWidth={1.75} /> : it.type === 'mind' ? <Brain strokeWidth={1.75} /> : <StickyNote strokeWidth={1.75} />
  const to = it.type === 'meal' && it.refId ? `/recipes/${it.refId}` : it.type === 'mind' && it.refId ? `/mind/${it.refId}` : undefined
  // Carry the visual through: a saved meal only stores refId, so look the recipe's photo back up.
  const thumb = it.type === 'meal' && it.refId ? recipes.find((r) => r.id === it.refId)?.thumbnail : undefined
  const body = (
    <div className="card-row">
      <div className="thumb">{thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : icon}</div>
      <div className="card-body"><span className="eyebrow">{label}</span><h3>{it.title}</h3><div className="meta" style={{ whiteSpace: 'normal' }}>{sub}</div></div>
    </div>
  )
  return (
    <div className="today-entry">
      {to ? <Link to={to} className="card">{body}</Link> : <div className="card">{body}</div>}
      <EntryMenu title={it.title} onSubstitute={onSwap} onRemove={onRemove} />
    </div>
  )
}

export default function Today() {
  const { user } = useAuth()
  // #257: show the "meet your coach" welcome card ONLY for genuinely-new users — no completed
  // onboarding AND no coach profile yet (existing users predate `onboardedAt`, so guard on
  // hasCoachProfile too or they'd all see it). Skippable for the session.
  const [skipOnb, setSkipOnb] = useState(() => sessionStorage.getItem('onb-skip') === '1')
  const showOnboarding = !!user && !user.onboardedAt && !user.hasCoachProfile && !skipOnb
  const [selDay, setSelDay] = useState(todayISO())
  const todaysLogs = useLiveQuery(() => db.logs.where('date').equals(todayISO()).toArray())
  const dayLogs = useLiveQuery(() => db.logs.where('date').equals(selDay).toArray(), [selDay]) ?? []
  const doneTitles = new Set(dayLogs.map((l) => (l.title || '').toLowerCase().trim()))
  const diet = useLiveQuery(() => getSetting('diet'))
  const [events, setEvents] = useState<IcuEvent[] | null>(null)
  const [activities, setActivities] = useState<IcuActivity[]>([])
  const [plans, setPlans] = useState<CoachPlan[]>([])
  const [items, setItems] = useState<CalItem[]>([])
  const [checkin, setCheckin] = useState<Checkin | null>(null) // #202: drives the readiness verdict banner
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [err, setErr] = useState<string>()
  // #146: the Add sheet opens IN PLACE on Today (the same shared sheet the Plan page uses).
  const [sheet, setSheet] = useState<{ date: string } | null>(null)
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [rideTemplates, setRideTemplates] = useState<RideTemplate[]>([])
  const [ftp, setFtp] = useState(260)
  const navigate = useNavigate()

  const load = useCallback(() => {
    const [a, b] = weekRange()
    fetchEvents(a, b).then((evs) => { setEvents(evs); setPlanEvents(evs) }).catch((e) => setErr((e as Error).message))
    // Mirror intervals-origin workouts into Platyplus first, THEN read the owned plans.
    syncIcuPlans(a, b).finally(() => fetchGymPlans(a, b).then((pl) => { setPlans(pl); setCoachPlans(pl) }))
    fetchActivities(a, b).then(setActivities).catch(() => setActivities([]))
    calApi.items(a, b).then(setItems).catch(() => setItems([]))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { listTemplates().then(setTemplates); listRideTemplates().then(setRideTemplates); getSetting('ftp').then((v) => { if (v) setFtp(Number(v)) }) }, [])

  function runPlan(p: CoachPlan) {
    if (p.sport === 'gym') { setGymSession(gymSessionFromPlan(p)); navigate('/gym-session/play') }
    else { setCurrentRide({ title: p.title, sport: p.sport === 'ride' ? 'cycling' : 'running', segments: p.segments || [], ftp: p.ftp || 260, source: p.id }); navigate(p.sport === 'ride' ? '/ride-player' : '/run-player') }
  }

  // Editable here too: Remove deletes (intervals event → writes back; coach plan → local).
  // Substitute jumps to that day's calendar where the full swap sheet lives.
  async function removeEvent(e: IcuEvent) {
    if (!confirm(`Remove “${e.name}” from your intervals calendar?`)) return
    try { await deleteEvent(e.id) } catch { alert('Could not remove that intervals event.'); return }
    load()
  }
  async function removePlan(p: CoachPlan) {
    if (!confirm(`Remove “${p.title}”?`)) return
    await calApi.delPlan(p.id); load()
  }
  async function removeItem(it: CalItem) { await calApi.delItem(it.id); load() }
  // #146: Add/Substitute open the shared Add sheet IN PLACE on Today — no navigating
  // away to /plan (JM disliked the jump). Adds reload via onAdd=load.
  const swapOn = (day: string) => setSheet({ date: day })

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })()
  // Merge-by-id: a coach/owned plan that's already shown as an intervals event card
  // (matched by external_id OR by the mirror icuEventId) is hidden so there's no dupe.
  const linkedIds = new Set((events ?? []).map((e) => e.external_id).filter(Boolean))
  const shownEventIds = new Set((events ?? []).map((e) => String(e.id)))
  // Also dedup an UNLINKED Platyplus plan against an intervals event that's the SAME
  // planned workout (same day + sport + title) — e.g. the coach published straight to
  // intervals and a separate Platyplus plan exists. Show one (the intervals event), hide the plan.
  const shownEventKeys = new Set((events ?? []).map((e) => `${e.start_date_local.slice(0, 10)}|${sportOf(e)}|${String(e.name || '').trim().toLowerCase()}`))
  const planKey = (p: CoachPlan) => `${p.date}|${p.sport === 'ride' ? 'cycling' : p.sport}|${String(p.title || '').trim().toLowerCase()}`
  const planShown = (p: CoachPlan) => linkedIds.has(p.id) || (p.icuEventId != null && shownEventIds.has(String(p.icuEventId))) || shownEventKeys.has(planKey(p))
  const dayEvents = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) === selDay)
  const dayPlans = plans.filter((p) => p.date === selDay && !planShown(p))
  const dayItems = items.filter((it) => it.date === selDay)
  // #202: meals/mind/recovery/supplement get their own sections; notes stay with the workouts.
  const dayMeals = dayItems.filter((it) => it.type === 'meal')
  const dayMindItems = dayItems.filter((it) => it.type === 'mind')
  const daySupps = dayItems.filter((it) => it.type === 'supplement')
  const dayRecovery = dayItems.filter((it) => it.type === 'recovery')
  const dayNotes = dayItems.filter((it) => it.type === 'note')
  const hasWorkout = dayEvents.length > 0 || dayPlans.length > 0
  const isFuture = selDay > todayISO() // #223: future days forecast, not a live verdict
  const verdict = isFuture ? null : readinessVerdict(checkin)
  // Days that have anything on them → a tiny dot under the WeekStrip day (#66).
  const markedDays = new Set<string>([
    ...(events ?? []).map((e) => e.start_date_local.slice(0, 10)),
    ...plans.map((p) => p.date),
    ...items.map((it) => it.date),
    ...activities.map((a) => (a.start_date_local || '').slice(0, 10)).filter(Boolean),
  ])
  // Match a completed intervals.icu activity to a planned workout by day + sport.
  const actFor = (day: string, sport: string) => activities.find((a) => a.start_date_local.slice(0, 10) === day && sportOfActivity(a) === (sport === 'cycling' ? 'ride' : sport))

  // Daily fuel (diet-aware) + a mind reset for the selected day.
  const dietOk = (r: Recipe) => {
    const p = diet ?? 'vegetarian'
    if (p === 'no preference') return true
    if (p === 'vegan') return !!r.diet?.includes('vegan')
    return !!(r.diet?.includes('vegetarian') || r.diet?.includes('vegan'))
  }
  // Suggestion logic: diet-filtered + WORKOUT-AWARE. Match fuel to the day's training —
  // endurance burns glycogen → carb-forward; a strength day → protein-forward; rest →
  // balanced & lighter. Includes a snack. (Aligns with the coach's nutrition method.)
  const endEvents = dayEvents.filter((e) => ['cycling', 'run'].includes(sportOf(e)) || e.type === 'Run')
  const endPlans = dayPlans.filter((p) => p.sport === 'ride' || p.sport === 'run')
  const endMins = endEvents.reduce((s, e) => s + (e.moving_time ? e.moving_time / 60 : 0), 0) + endPlans.reduce((s, p) => s + (p.segments || []).reduce((a, x) => a + x.duration, 0) / 60, 0)
  const endTSS = Math.max(0, ...endEvents.map((e) => e.icu_training_load || 0))
  const hasEndurance = endEvents.length > 0 || endPlans.length > 0
  const hasStrength = dayEvents.some((e) => sportOf(e) === 'gym') || dayPlans.some((p) => p.sport === 'gym')
  const bigEndurance = endTSS >= 60 || endMins >= 90
  const fuelMode: 'carb' | 'protein' | 'balanced' = hasEndurance ? 'carb' : hasStrength ? 'protein' : 'balanced'
  const fuelMsg = fuelMode === 'carb' ? `Carb-forward to fuel & refill${bigEndurance ? ' a big endurance day' : ' for endurance'}.` : fuelMode === 'protein' ? 'Protein-forward for strength & recovery.' : 'Balanced, lighter picks for a rest day.'
  const suggestMeal = (cat: Recipe['category'], salt: number) => {
    let pool = recipes.filter((r) => r.category === cat && dietOk(r))
    if (pool.length > 6) {
      const third = Math.max(6, Math.ceil(pool.length / 3))
      if (fuelMode === 'carb') pool = [...pool].sort((a, b) => (b.carbs ?? 0) - (a.carbs ?? 0)).slice(0, third)
      else if (fuelMode === 'protein') pool = [...pool].sort((a, b) => (b.protein ?? 0) - (a.protein ?? 0)).slice(0, third)
      else pool = [...pool].sort((a, b) => (a.kcal ?? 0) - (b.kcal ?? 0)).slice(0, Math.max(6, Math.ceil(pool.length / 2)))
    }
    return pickByDate(pool, selDay, salt)
  }
  const meals = (['breakfast', 'lunch', 'snack', 'dinner'] as const).map((cat, i) => suggestMeal(cat, i + 1)).filter(Boolean) as Recipe[]
  const meditation = pickByDate(mindSessions, selDay, 7)
  async function add(key: string, item: Parameters<typeof calApi.saveItem>[0]) {
    try { await calApi.saveItem(item); load(); setAdded((a) => ({ ...a, [key]: true })); setTimeout(() => setAdded((a) => { const n = { ...a }; delete n[key]; return n }), 1600) }
    catch { alert('Could not add — are you signed in?') }
  }
  const addMealSuggestion = (r: Recipe) => add(r.id, { date: selDay, type: 'meal', title: r.title, refId: r.id, mealType: r.category, kcal: r.kcal })
  const addMindSuggestion = () => { if (meditation) add('mind:' + meditation.id, { date: selDay, type: 'mind', title: meditation.title, refId: meditation.id, minutes: meditation.duration }) }

  // #202: unify scheduled meals (shown once) vs the algorithmic suggestions into 2-col fuel chips.
  const mealEmoji: Record<string, string> = { breakfast: '🥣', lunch: '🥗', dinner: '🍝', snack: '🍌', meal: '🍽️' }
  type FuelChip = { key: string; tag: string; title: string; kcal?: number; recipeId?: string; thumb?: string; sug?: Recipe }
  const fuelChips: FuelChip[] = dayMeals.length
    ? dayMeals.map((it) => ({ key: it.id, tag: it.mealType || 'meal', title: it.title, kcal: it.kcal, recipeId: it.refId }))
    : meals.map((r) => ({ key: r.id, tag: r.category, title: r.title, kcal: r.kcal, recipeId: r.id, thumb: r.thumbnail, sug: r }))
  const mindItem = dayMindItems[0]
  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{greeting}</span>
        <h1>Ready to train?</h1>
      </div>

      {showOnboarding && (
        <div className="card onb-card">
          <div className="onb-card__ic"><img src="/favicon.svg?v=4" alt="" style={{ width: 34, height: 34, borderRadius: 9 }} /></div>
          <div className="onb-card__b">
            <h3>Meet your coach</h3>
            <p>A 2-minute chat (tap, type, or talk) and your coach builds your first week around your real life.</p>
            <div className="onb-card__row">
              <button className="btn" style={{ width: 'auto' }} onClick={() => navigate('/chat?onboard=1')}>Set me up →</button>
              <button className="btn auth-link" style={{ width: 'auto' }} onClick={() => { sessionStorage.setItem('onb-skip', '1'); setSkipOnb(true) }}>Skip for now</button>
            </div>
          </div>
        </div>
      )}

      <WeekStrip selected={selDay} onSelect={setSelDay} marked={markedDays} />

      {/* #223: today = check-in + live verdict; future = freshness FORECAST (no fake "fresh"); past = logged. */}
      {isFuture ? <ForecastCard key={selDay} day={selDay} fmtDay={fmtDay} /> : <CheckInCard key={selDay} day={selDay} onChange={setCheckin} />}

      {todaysLogs && todaysLogs.length > 0 && (
        <Link to="/progress" style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 700, marginTop: 4 }}>✓ {todaysLogs.length} logged today — see history →</Link>
      )}

      {/* #202 Today's plan (workouts + notes) with the readiness verdict banner */}
      <div className="cal-day-head" style={{ marginTop: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>{selDay === todayISO() ? "Today's plan" : fmtDay(selDay)}</div>
        <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => swapOn(selDay)}><Plus size={16} /> Add</button>
      </div>
      {err === 'NO_KEY' ? (
        <p className="meta">Connect intervals.icu in <Link to="/profile">Profile</Link> for your coach's plan — you can still add your own below.</p>
      ) : err ? (
        <p className="meta">Couldn't load plan: {err}</p>
      ) : events === null ? (
        <p className="meta">Loading your plan…</p>
      ) : null}
      {hasWorkout && verdict && (
        <div className={'ready-banner ready-banner--' + verdict.tone}><span className="ready-banner__dot" />{verdict.text}</div>
      )}
      {hasWorkout || dayNotes.length > 0 ? (
        <div className="stack">
          {dayEvents.map((e) => <PlanCard key={e.id} e={e} act={actFor(selDay, sportOf(e))} done={doneTitles.has(e.name.toLowerCase().trim())} onSwap={() => swapOn(selDay)} onRemove={() => removeEvent(e)} />)}
          {dayPlans.map((p) => <CoachPlanCard key={p.id} p={p} act={actFor(selDay, p.sport)} done={doneTitles.has(p.title.toLowerCase().trim())} onRun={runPlan} fmtDay={fmtDay} onSwap={() => swapOn(selDay)} onRemove={() => removePlan(p)} />)}
          {dayNotes.map((it) => <ItemCard key={it.id} it={it} onSwap={() => swapOn(selDay)} onRemove={() => removeItem(it)} />)}
        </div>
      ) : events !== null && !err ? (
        <p className="meta">Nothing scheduled — tap Add, or enjoy a rest day.</p>
      ) : null}

      {/* #202 Fuel — scheduled meals shown once as 2-col chips; else carb/protein-aware suggestions; + supplements */}
      {(fuelChips.length > 0 || daySupps.length > 0) && (
        <>
          <div className="section-title sec-ico">🍽️ Fuel <InfoDot text={`${fuelMsg}${dayMeals.length ? '' : ' Tap + to add a meal to your day.'}`} /></div>
          {dayMeals.length === 0 && fuelChips.length > 0 && <p className="meta" style={{ margin: '-2px 2px 8px' }}>{fuelMsg}</p>}
          {fuelChips.length > 0 && (
            <div className="fuel-grid">
              {fuelChips.map((c) => (
                <div key={c.key} className="mealchip">
                  <Link to={c.recipeId ? `/recipes/${c.recipeId}` : '#'} className="mealchip__link">
                    <div className="mealchip__thumb">{c.thumb ? <img src={c.thumb} alt="" /> : <span>{mealEmoji[c.tag] || '🍽️'}</span>}</div>
                    <div className="mealchip__body"><span className="mealchip__tag">{c.tag}</span><div className="mealchip__nm">{c.title}</div>{c.kcal ? <div className="mealchip__mc">{c.kcal} kcal</div> : null}</div>
                  </Link>
                  {c.sug && <button className="mealchip__add" aria-label="Add to this day" onClick={(e) => { e.preventDefault(); addMealSuggestion(c.sug!) }}>{added[c.sug.id] ? <Check size={15} /> : <Plus size={15} />}</button>}
                </div>
              ))}
            </div>
          )}
          {daySupps.length > 0 && (
            <div className="supps">
              <span className="supps__hdr">💊 Supplements</span>
              {daySupps.map((s) => <span key={s.id} className="suppchip">{s.title}<button className="suppchip__x" aria-label={`Remove ${s.title}`} onClick={() => removeItem(s)}>×</button></span>)}
            </div>
          )}
        </>
      )}

      {/* #202 Recovery — sauna / cold / massage / mobility (scheduled blocks) */}
      {dayRecovery.length > 0 && (
        <>
          <div className="section-title sec-ico">🛌 Recovery</div>
          <div className="stack">
            {dayRecovery.map((r) => (
              <div key={r.id} className="today-entry">
                <div className="card">
                  <div className="card-row">
                    <div className="thumb" style={{ fontSize: 22 }}>{RECOVERY_EMOJI[r.kind || ''] || '🛌'}</div>
                    <div className="card-body"><h3>{r.title}</h3><div className="meta"><span>{r.minutes ? `${r.minutes} min` : 'recovery'}</span>{r.kind ? <span className="dot">{r.kind}</span> : null}</div></div>
                  </div>
                </div>
                <button className="entry-kebab" style={{ position: 'absolute', top: 12, right: 12 }} aria-label="Remove" title="Remove" onClick={() => removeItem(r)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* #202 Mind — scheduled mind session shown once; else a suggested reset */}
      {(mindItem || meditation) && (
        <>
          <div className="section-title sec-ico">🧠 Mind</div>
          <div className="stack">
            <div className="today-entry">
              <Link to={`/mind/${mindItem?.refId || meditation?.id}`} className="card">
                <div className="card-row">
                  <div className="thumb"><Brain strokeWidth={1.75} /></div>
                  <div className="card-body">
                    <span className="eyebrow">{mindItem ? 'scheduled' : meditation?.kind}</span>
                    <h3>{mindItem?.title || meditation?.title}</h3>
                    <div className="meta"><span>{(mindItem?.minutes || meditation?.duration) ? `${mindItem?.minutes || meditation?.duration} min` : 'audio'}</span>{!mindItem && meditation?.coach ? <span className="dot">{meditation.coach}</span> : null}</div>
                  </div>
                </div>
              </Link>
              {!mindItem && meditation && <button className="entry-kebab" style={{ position: 'absolute', top: 12, right: 12, color: added['mind:' + meditation.id] ? 'var(--accent,#34e07d)' : undefined, borderColor: added['mind:' + meditation.id] ? 'var(--accent,#34e07d)' : undefined }} aria-label="Add to this day" title="Add to this day" onClick={(e) => { e.preventDefault(); addMindSuggestion() }}>{added['mind:' + meditation.id] ? <Check size={18} /> : <Plus size={18} />}</button>}
            </div>
          </div>
        </>
      )}

      {sheet && <AddSheet date={sheet.date} ftp={ftp} templates={templates} rideTemplates={rideTemplates} onClose={() => setSheet(null)} onAdd={load} />}
    </div>
  )
}
