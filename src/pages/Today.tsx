import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { WeekStrip, MiniProfile, DoneStats } from '../ui'
import { fetchEvents, deleteEvent, eventObjective, sportOf, flattenIcuSteps, fetchActivities, sportOfActivity, type IcuEvent, type IcuActivity } from '../intervals'
import { setPlanEvents, fetchGymPlans, syncIcuPlans, gymSessionFromPlan, setGymSession, type CoachPlan } from '../plan'
import { setCurrentRide } from '../ride'
import { calApi, type CalItem } from '../calendar'
import { recipes, mindSessions } from '../data/catalog'
import type { Recipe } from '../types'
import { localISO } from '../date'
import { Bike, Dumbbell, Footprints, Target, Salad, Brain, StickyNote, Plus, Check, Flag } from 'lucide-react'
import { EntryMenu } from '../EntryMenu'
import { authApi, type Checkin } from '../auth/api'
import { InfoDot } from '../charts'

/** Quick "how do you feel" check-in (energy/sleep/soreness) — a few taps, feeds the coach. */
function CheckInCard() {
  const today = localISO()
  const [ci, setCi] = useState<Checkin | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { authApi.checkins(today, today).then((a) => setCi(a[0] || null)).catch(() => {}).finally(() => setLoaded(true)) }, [today])
  const set = (patch: Partial<Checkin>) => { const next = { ...(ci || { date: today }), ...patch } as Checkin; setCi(next); authApi.checkin(next).catch(() => {}) }
  if (!loaded) return null
  // Emoji faces, 1–5, ALWAYS visible (JM: must not be hidden behind a tap or it gets
  // skipped). One tap; the picked face lights up in the Platyplus green; others dim.
  // Each row's faces match that metric's meaning (soreness 1 = fresh, 5 = wrecked).
  const rows: { key: 'energy' | 'sleep' | 'soreness'; label: string; info: string; faces: string[] }[] = [
    { key: 'energy', label: 'Energy', info: 'How energized you feel right now, 1–5 (1 = wiped out, 5 = full of energy).', faces: ['😵', '😕', '😐', '🙂', '😄'] },
    { key: 'sleep', label: 'Sleep', info: 'Last night’s sleep, 1–5 (1 = terrible, 5 = perfect rest). If you track sleep with a device that syncs to intervals.icu, your sleep score also reaches the coach automatically — this is the manual signal otherwise.', faces: ['😣', '😪', '😐', '🙂', '😌'] },
    { key: 'soreness', label: 'Soreness', info: 'Muscle soreness, 1–5 (1 = none, 5 = very sore). Higher tells the coach to ease off.', faces: ['😄', '🙂', '😐', '😣', '😖'] },
  ]
  return (
    <div className="card checkin">
      <div className="checkin__t">How do you feel today?</div>
      {rows.map((r) => (
        <div key={r.key} className="checkin__row2">
          <span className="checkin__lbl">{r.label} <InfoDot text={r.info} /></span>
          <div className="checkin__faces">
            {r.faces.map((f, i) => {
              const n = i + 1, on = ci?.[r.key] === n
              return <button key={n} className={'checkin__face' + (on ? ' on' : '')} aria-label={`${r.label} ${n} of 5`} aria-pressed={on} onClick={() => set({ [r.key]: n })}>{f}</button>
            })}
          </div>
        </div>
      ))}
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

/** A coach-pushed plan that isn't mirrored by an intervals event — runs in-app. */
function CoachPlanCard({ p, onRun, showDate, fmtDay, onSwap, onRemove, done, act }: { p: CoachPlan; onRun: (p: CoachPlan) => void; showDate?: boolean; fmtDay: (s: string) => string; onSwap?: () => void; onRemove?: () => void; done?: boolean; act?: IcuActivity }) {
  const mins = p.sport === 'gym' ? undefined : Math.round((p.segments || []).reduce((s, x) => s + x.duration, 0) / 60)
  const segs = (p.sport === 'ride' || p.sport === 'run') ? (p.segments || []) : []
  const isDone = done || !!act
  return (
    <div className="today-entry">
      <button className="card" style={{ textAlign: 'left', width: '100%' }} onClick={() => onRun(p)}>
        <div className="card-row">
          {segs.length
            ? <div className="thumb"><MiniProfile segs={segs} /></div>
            : <div className={'thumb thumb--' + (p.sport === 'ride' ? 'ride' : p.sport === 'run' ? 'run' : 'gym')}>{planIcon(p.sport)}</div>}
          <div className="card-body">
            <span className="eyebrow">{p.sport === 'ride' ? 'Ride' : p.sport === 'run' ? 'Run' : 'Gym'} · in-app{showDate ? ` · ${fmtDay(p.date)}` : ''}</span>
            <h3 style={isDone ? { opacity: 0.6 } : undefined}>{p.title}</h3>
            {p.notes && <div className="meta" style={{ display: 'block', whiteSpace: 'normal' }}>{p.notes.length > 110 ? p.notes.slice(0, 110) + '…' : p.notes}</div>}
            {act ? <DoneStats a={act} /> : <div className="meta">{mins ? <span>{mins} min</span> : <span>{(p.exercises || []).length} exercises{p.rounds && p.rounds > 1 ? ` · ${p.rounds} rounds` : ''}</span>}{done ? <span className="dot" style={{ color: 'var(--accent,#34e07d)' }}>✓ done</span> : <span className="dot">▶ start</span>}</div>}
          </div>
        </div>
      </button>
      {onSwap && onRemove && <EntryMenu title={p.title} onSubstitute={onSwap} onRemove={onRemove} />}
    </div>
  )
}

const iso = localISO
const todayISO = () => localISO()
function weekRange(): [string, string] {
  const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const end = new Date(mon); end.setDate(mon.getDate() + 13)
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
      <Link to={`/plan/${e.id}`} className="card">
        <div className="card-row">
          {rideSegs.length
            ? <div className="thumb"><MiniProfile segs={rideSegs} /></div>
            : <div className={'thumb thumb--' + (atp ? 'target' : e.category === 'TARGET' ? 'target' : sportOf(e) === 'gym' ? 'gym' : sportOf(e) === 'cycling' ? 'ride' : 'run')}>{atp ? <Flag strokeWidth={1.75} /> : sportIcon(e)}</div>}
          <div className="card-body">
            <span className="eyebrow">{atp ? 'Training block' : e.category === 'TARGET' ? 'Target' : sportOf(e) === 'gym' ? 'Gym' : sportOf(e) === 'cycling' ? 'Ride' : e.type}{showDate ? ` · ${fmtDay(e.start_date_local.slice(0, 10))}` : ''}</span>
            <h3 style={isDone ? { opacity: 0.6 } : undefined}>{e.name}</h3>
            {obj && <div className="meta" style={{ display: 'block', whiteSpace: 'normal' }}>{obj.length > 110 ? obj.slice(0, 110) + '…' : obj}</div>}
            {act ? <DoneStats a={act} /> : mins ? <div className="meta"><span>{mins} min</span>{e.icu_training_load ? <span className="dot">{e.icu_training_load} TSS</span> : null}{done ? <span className="dot" style={{ color: 'var(--accent,#34e07d)' }}>✓ done</span> : null}</div> : (done ? <div className="meta"><span style={{ color: 'var(--accent,#34e07d)' }}>✓ done</span></div> : null)}
          </div>
        </div>
      </Link>
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
  const [selDay, setSelDay] = useState(todayISO())
  const todaysLogs = useLiveQuery(() => db.logs.where('date').equals(todayISO()).toArray())
  const dayLogs = useLiveQuery(() => db.logs.where('date').equals(selDay).toArray(), [selDay]) ?? []
  const doneTitles = new Set(dayLogs.map((l) => (l.title || '').toLowerCase().trim()))
  const diet = useLiveQuery(() => getSetting('diet'))
  const [events, setEvents] = useState<IcuEvent[] | null>(null)
  const [activities, setActivities] = useState<IcuActivity[]>([])
  const [plans, setPlans] = useState<CoachPlan[]>([])
  const [items, setItems] = useState<CalItem[]>([])
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [err, setErr] = useState<string>()
  const navigate = useNavigate()

  const load = useCallback(() => {
    const [a, b] = weekRange()
    fetchEvents(a, b).then((evs) => { setEvents(evs); setPlanEvents(evs) }).catch((e) => setErr((e as Error).message))
    // Mirror intervals-origin workouts into Platyplus first, THEN read the owned plans.
    syncIcuPlans(a, b).finally(() => fetchGymPlans(a, b).then(setPlans))
    fetchActivities(a, b).then(setActivities).catch(() => setActivities([]))
    calApi.items(a, b).then(setItems).catch(() => setItems([]))
  }, [])
  useEffect(() => { load() }, [load])

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
  const swapOn = (day: string) => navigate(`/plan?d=${day}&v=day`)

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })()
  // Merge-by-id: a coach/owned plan that's already shown as an intervals event card
  // (matched by external_id OR by the mirror icuEventId) is hidden so there's no dupe.
  const linkedIds = new Set((events ?? []).map((e) => e.external_id).filter(Boolean))
  const shownEventIds = new Set((events ?? []).map((e) => String(e.id)))
  const planShown = (p: CoachPlan) => linkedIds.has(p.id) || (p.icuEventId != null && shownEventIds.has(String(p.icuEventId)))
  const dayEvents = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) === selDay)
  const dayPlans = plans.filter((p) => p.date === selDay && !planShown(p))
  const dayItems = items.filter((it) => it.date === selDay)
  const upcoming = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) > selDay).sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
  const upcomingPlans = plans.filter((p) => p.date > selDay && !planShown(p)).sort((a, b) => a.date.localeCompare(b.date))
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

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <span className="eyebrow">{greeting}</span>
          <h1>Ready to train?</h1>
        </div>
        <Link to="/progress" className="chip" style={{ marginTop: 6 }}>📈 History</Link>
      </div>

      <WeekStrip selected={selDay} onSelect={setSelDay} />

      {selDay === todayISO() && <CheckInCard />}

      {todaysLogs && todaysLogs.length > 0 && (
        <Link to="/progress" style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 700, marginTop: 4 }}>✓ {todaysLogs.length} logged today — see history →</Link>
      )}

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
      {dayEvents.length > 0 || dayPlans.length > 0 || dayItems.length > 0 ? (
        <div className="stack">
          {dayEvents.map((e) => <PlanCard key={e.id} e={e} act={actFor(selDay, sportOf(e))} done={doneTitles.has(e.name.toLowerCase().trim())} onSwap={() => swapOn(selDay)} onRemove={() => removeEvent(e)} />)}
          {dayPlans.map((p) => <CoachPlanCard key={p.id} p={p} act={actFor(selDay, p.sport)} done={doneTitles.has(p.title.toLowerCase().trim())} onRun={runPlan} fmtDay={fmtDay} onSwap={() => swapOn(selDay)} onRemove={() => removePlan(p)} />)}
          {dayItems.map((it) => <ItemCard key={it.id} it={it} onSwap={() => swapOn(selDay)} onRemove={() => removeItem(it)} />)}
        </div>
      ) : events !== null && !err ? (
        <p className="meta">Nothing scheduled — tap Add, or enjoy a rest day.</p>
      ) : null}

      {meals.length > 0 && (
        <>
          <div className="section-title">Suggested fuel{selDay !== todayISO() ? ` · ${fmtDay(selDay)}` : ''}</div>
          <p className="meta" style={{ margin: '-4px 2px 8px' }}>{fuelMsg}</p>
          <div className="stack">
            {meals.map((r) => (
              <div key={r.id} className="today-entry">
                <Link to={`/recipes/${r.id}`} className="card">
                  <div className="card-row">
                    <div className="thumb">{r.thumbnail ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Salad strokeWidth={1.75} />}</div>
                    <div className="card-body">
                      <span className="eyebrow">{r.category}</span>
                      <h3>{r.title}</h3>
                      <div className="meta"><span>{r.minutes} min</span><span className="dot">{r.kcal} kcal</span><span className="dot">{r.protein}g protein</span></div>
                    </div>
                  </div>
                </Link>
                <button className="entry-kebab" style={{ position: 'absolute', top: 12, right: 12, color: added[r.id] ? 'var(--accent,#34e07d)' : undefined, borderColor: added[r.id] ? 'var(--accent,#34e07d)' : undefined }} aria-label="Add to this day" title="Add to this day" onClick={(e) => { e.preventDefault(); addMealSuggestion(r) }}>{added[r.id] ? <Check size={18} /> : <Plus size={18} />}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {meditation && (
        <>
          <div className="section-title">Suggested reset</div>
          <div className="stack">
            <div className="today-entry">
              <Link to={`/mind/${meditation.id}`} className="card">
                <div className="card-row">
                  <div className="thumb"><Brain strokeWidth={1.75} /></div>
                  <div className="card-body">
                    <span className="eyebrow">{meditation.kind}</span>
                    <h3>{meditation.title}</h3>
                    <div className="meta"><span>{meditation.duration ? `${meditation.duration} min` : 'audio'}</span>{meditation.coach ? <span className="dot">{meditation.coach}</span> : null}</div>
                  </div>
                </div>
              </Link>
              <button className="entry-kebab" style={{ position: 'absolute', top: 12, right: 12, color: added['mind:' + meditation.id] ? 'var(--accent,#34e07d)' : undefined, borderColor: added['mind:' + meditation.id] ? 'var(--accent,#34e07d)' : undefined }} aria-label="Add to this day" title="Add to this day" onClick={(e) => { e.preventDefault(); addMindSuggestion() }}>{added['mind:' + meditation.id] ? <Check size={18} /> : <Plus size={18} />}</button>
            </div>
          </div>
        </>
      )}

      {(upcoming.length > 0 || upcomingPlans.length > 0) && (
        <>
          <div className="section-title">Coming up</div>
          <div className="stack">
            {upcoming.map((e) => <PlanCard key={e.id} e={e} showDate onSwap={() => swapOn(e.start_date_local.slice(0, 10))} onRemove={() => removeEvent(e)} />)}
            {upcomingPlans.map((p) => <CoachPlanCard key={p.id} p={p} onRun={runPlan} showDate fmtDay={fmtDay} onSwap={() => swapOn(p.date)} onRemove={() => removePlan(p)} />)}
          </div>
        </>
      )}

    </div>
  )
}
